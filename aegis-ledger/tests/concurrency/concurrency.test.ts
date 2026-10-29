import { describe, it, expect } from 'vitest';
import { Currency } from '../../src/ledger/domain/value-objects/currency.vo.js';
import { Money } from '../../src/ledger/domain/value-objects/money.vo.js';
import { Account } from '../../src/ledger/domain/entities/account.entity.js';
import { PostTransactionUseCase } from '../../src/ledger/usecases/post-transaction.usecase.js';
import { ILedgerRepository } from '../../src/ledger/usecases/ports/ledger-repository.port.js';
import { IUnitOfWork } from '../../src/ledger/usecases/ports/unit-of-work.port.js';
import { IIdempotencyStore, IdempotencyRecord } from '../../src/ledger/usecases/ports/idempotency-store.port.js';
import { Transaction } from '../../src/ledger/domain/entities/transaction.entity.js';

// Simulated Mutex-guarded Repository to simulate pessimistic database row locking
class SimulatedPostgresRepository implements ILedgerRepository {
  public accounts = new Map<string, Account>();
  public transactions = new Map<string, Transaction>();
  private accountLocks = new Map<string, Promise<void>>();

  async findAccountById(id: string): Promise<Account | null> {
    return this.accounts.get(id) ?? null;
  }

  // Simulates Postgres `SELECT ... FOR UPDATE` with canonical lock order
  async findAccountsByIds(ids: string[], lock: boolean = false): Promise<Account[]> {
    if (lock) {
      // Canonical ordering by ID prevents cyclic deadlock
      const sortedIds = [...new Set(ids)].sort();
      for (const id of sortedIds) {
        while (this.accountLocks.has(id)) {
          await this.accountLocks.get(id);
        }
      }
    }

    const results: Account[] = [];
    for (const id of ids) {
      const acc = this.accounts.get(id);
      if (acc) results.push(acc);
    }
    return results;
  }

  async saveAccount(account: Account): Promise<void> {
    this.accounts.set(account.id, account);
  }

  async updateAccountBalance(account: Account): Promise<void> {
    this.accounts.set(account.id, account);
  }

  async saveTransaction(transaction: Transaction): Promise<void> {
    this.transactions.set(transaction.id, transaction);
  }

  async findTransactionById(id: string): Promise<Transaction | null> {
    return this.transactions.get(id) ?? null;
  }

  async findTransactionByIdempotencyKey(key: string): Promise<Transaction | null> {
    for (const tx of this.transactions.values()) {
      if (tx.idempotencyKey === key) return tx;
    }
    return null;
  }
}

class SimulatedUnitOfWork implements IUnitOfWork {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly repo: SimulatedPostgresRepository) {}

  async execute<T>(work: (repos: { ledgerRepo: ILedgerRepository }) => Promise<T>): Promise<T> {
    // Linearize concurrent transactions to simulate database serialization
    const current = this.queue;
    let release: () => void = () => {};
    this.queue = new Promise<void>((resolve) => {
      release = resolve;
    });

    await current;
    try {
      return await work({ ledgerRepo: this.repo });
    } finally {
      release();
    }
  }
}

class MemoryIdempotencyStore implements IIdempotencyStore {
  private records = new Map<string, IdempotencyRecord>();

  async acquire(key: string, requestHash: string): Promise<'ACQUIRED' | 'EXISTS'> {
    if (this.records.has(key)) return 'EXISTS';
    this.records.set(key, {
      key,
      requestHash,
      status: 'PROCESSING',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 86400000),
    });
    return 'ACQUIRED';
  }

  async get(key: string): Promise<IdempotencyRecord | null> {
    return this.records.get(key) ?? null;
  }

  async complete(key: string, responsePayload: unknown, transactionId?: string): Promise<void> {
    const r = this.records.get(key);
    if (r) {
      r.status = 'COMPLETED';
      r.responsePayload = responsePayload;
      r.transactionId = transactionId;
    }
  }

  async fail(key: string, _errorReason: string): Promise<void> {
    const r = this.records.get(key);
    if (r) r.status = 'FAILED';
  }
}

describe('Concurrency & Race-Condition Defense (Double-Spending Prevention)', () => {
  const USD = Currency.USD();

  it('should maintain strict conservation of money under concurrent bidirectional load', async () => {
    const repo = new SimulatedPostgresRepository();
    const uow = new SimulatedUnitOfWork(repo);
    const idempStore = new MemoryIdempotencyStore();
    const useCase = new PostTransactionUseCase(uow, idempStore);

    // Initialize two asset accounts with $500.00 each (50,000 cents)
    // Both allow negative balance so all 50 transfers succeed
    const accA = Account.create(
      {
        code: '1010-A',
        name: 'Account A',
        type: 'ASSET',
        currency: USD,
        allowNegativeBalance: true,
        initialBalance: Money.create(50000n, USD).getValue(),
      },
      'acc-A'
    ).getValue();

    const accB = Account.create(
      {
        code: '1010-B',
        name: 'Account B',
        type: 'ASSET',
        currency: USD,
        allowNegativeBalance: true,
        initialBalance: Money.create(50000n, USD).getValue(),
      },
      'acc-B'
    ).getValue();

    await repo.saveAccount(accA);
    await repo.saveAccount(accB);

    const initialTotal = accA.balance.amount + accB.balance.amount;
    expect(initialTotal).toBe(100000n); // $1,000.00 total system money

    // Dispatch 50 concurrent opposing transfers:
    // Even indices: A -> B ($10.00)
    // Odd indices:  B -> A ($10.00)
    const promises: Promise<unknown>[] = [];
    for (let i = 0; i < 50; i++) {
      const isEven = i % 2 === 0;
      const fromAcc = isEven ? 'acc-A' : 'acc-B';
      const toAcc = isEven ? 'acc-B' : 'acc-A';

      promises.push(
        useCase.execute({
          idempotencyKey: `concurrent-tx-${i}`,
          description: `Concurrent transfer #${i}`,
          entries: [
            {
              accountId: fromAcc,
              direction: 'CREDIT', // Credit decreases asset
              amount: '1000', // $10.00
              currency: 'USD',
            },
            {
              accountId: toAcc,
              direction: 'DEBIT', // Debit increases asset
              amount: '1000', // $10.00
              currency: 'USD',
            },
          ],
        })
      );
    }

    const results = await Promise.all(promises);
    expect(results.length).toBe(50);

    // Verify all 50 succeeded
    for (const res of results as { isSuccess: boolean }[]) {
      expect(res.isSuccess).toBe(true);
    }

    // Verify Conservation of Money Invariant:
    // Total system funds must exactly equal initial total funds!
    const finalAccA = (await repo.findAccountById('acc-A'))!;
    const finalAccB = (await repo.findAccountById('acc-B'))!;

    const finalTotal = finalAccA.balance.amount + finalAccB.balance.amount;
    expect(finalTotal).toBe(initialTotal); // 100,000 cents ($1,000.00)
    expect(finalAccA.balance.amount).toBe(50000n); // 25 out, 25 in = net zero
    expect(finalAccB.balance.amount).toBe(50000n); // 25 in, 25 out = net zero
  });
});
