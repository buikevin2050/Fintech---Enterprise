import { describe, it, expect, beforeEach } from 'vitest';
import { PostTransactionUseCase } from '../../../src/ledger/usecases/post-transaction.usecase.js';
import { ILedgerRepository } from '../../../src/ledger/usecases/ports/ledger-repository.port.js';
import { IUnitOfWork } from '../../../src/ledger/usecases/ports/unit-of-work.port.js';
import { IIdempotencyStore, IdempotencyRecord } from '../../../src/ledger/usecases/ports/idempotency-store.port.js';
import { Account } from '../../../src/ledger/domain/entities/account.entity.js';
import { Transaction } from '../../../src/ledger/domain/entities/transaction.entity.js';
import { Currency } from '../../../src/ledger/domain/value-objects/currency.vo.js';
import { Money } from '../../../src/ledger/domain/value-objects/money.vo.js';

// In-Memory Repository Stub
class InMemoryLedgerRepository implements ILedgerRepository {
  public accounts = new Map<string, Account>();
  public transactions = new Map<string, Transaction>();

  async findAccountById(id: string): Promise<Account | null> {
    const acc = this.accounts.get(id);
    return acc ? this.cloneAccount(acc) : null;
  }

  async findAccountsByIds(ids: string[]): Promise<Account[]> {
    const found: Account[] = [];
    for (const id of ids) {
      const acc = this.accounts.get(id);
      if (acc) found.push(acc);
    }
    return found;
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

  private cloneAccount(acc: Account): Account {
    return Account.create(
      {
        code: acc.code,
        name: acc.name,
        type: acc.type,
        currency: acc.currency,
        initialBalance: acc.balance,
        status: acc.status,
        allowNegativeBalance: acc.allowNegativeBalance,
        version: acc.version,
        createdAt: acc.createdAt,
        updatedAt: acc.updatedAt,
      },
      acc.id
    ).getValue();
  }
}

// In-Memory Unit of Work Stub
class InMemoryUnitOfWork implements IUnitOfWork {
  constructor(private readonly repo: InMemoryLedgerRepository) {}

  async execute<T>(work: (repos: { ledgerRepo: ILedgerRepository }) => Promise<T>): Promise<T> {
    return work({ ledgerRepo: this.repo });
  }
}

// In-Memory Idempotency Store Stub
class InMemoryIdempotencyStore implements IIdempotencyStore {
  private records = new Map<string, IdempotencyRecord>();

  async acquire(key: string, requestHash: string): Promise<'ACQUIRED' | 'EXISTS'> {
    if (this.records.has(key)) {
      return 'EXISTS';
    }
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
    const existing = this.records.get(key);
    if (existing) {
      existing.status = 'COMPLETED';
      existing.responsePayload = responsePayload;
      existing.transactionId = transactionId;
    }
  }

  async fail(key: string, _errorReason: string): Promise<void> {
    const existing = this.records.get(key);
    if (existing) {
      existing.status = 'FAILED';
    }
  }
}

describe('PostTransactionUseCase', () => {
  let ledgerRepo: InMemoryLedgerRepository;
  let unitOfWork: InMemoryUnitOfWork;
  let idempotencyStore: InMemoryIdempotencyStore;
  let useCase: PostTransactionUseCase;
  const USD = Currency.USD();

  beforeEach(() => {
    ledgerRepo = new InMemoryLedgerRepository();
    unitOfWork = new InMemoryUnitOfWork(ledgerRepo);
    idempotencyStore = new InMemoryIdempotencyStore();
    useCase = new PostTransactionUseCase(unitOfWork, idempotencyStore);

    // Seed Accounts: Operating Cash ($1,000) and Customer Deposits ($1,000)
    const cashAccount = Account.create(
      {
        code: '1010',
        name: 'Operating Cash',
        type: 'ASSET',
        currency: USD,
        allowNegativeBalance: false,
        initialBalance: Money.create(100000n, USD).getValue(), // $1,000.00
      },
      'acc-cash'
    ).getValue();

    const liabilityAccount = Account.create(
      {
        code: '2010',
        name: 'Customer Deposits',
        type: 'LIABILITY',
        currency: USD,
        allowNegativeBalance: false,
        initialBalance: Money.create(100000n, USD).getValue(), // $1,000.00
      },
      'acc-deposit'
    ).getValue();

    ledgerRepo.saveAccount(cashAccount);
    ledgerRepo.saveAccount(liabilityAccount);
  });

  it('should post a valid balanced transaction and update account balances', async () => {
    const input = {
      idempotencyKey: 'idemp-tx-100',
      description: 'Transfer $200 from deposit to cash',
      entries: [
        {
          accountId: 'acc-cash',
          direction: 'DEBIT' as const,
          amount: '20000',
          currency: 'USD',
          description: 'Debit Cash',
        },
        {
          accountId: 'acc-deposit',
          direction: 'CREDIT' as const,
          amount: '20000',
          currency: 'USD',
          description: 'Credit Deposit',
        },
      ],
    };

    const result = await useCase.execute(input);
    expect(result.isSuccess).toBe(true);

    const output = result.getValue();
    expect(output.status).toBe('POSTED');
    expect(output.entries.length).toBe(2);

    // Verify balances
    const updatedCash = (await ledgerRepo.findAccountById('acc-cash'))!;
    const updatedDeposit = (await ledgerRepo.findAccountById('acc-deposit'))!;

    // Asset was 100000, debited 20000 -> 120000
    expect(updatedCash.balance.amount).toBe(120000n);
    // Liability was 100000, credited 20000 -> 120000
    expect(updatedDeposit.balance.amount).toBe(120000n);
  });

  it('should guarantee idempotency: duplicate requests return identical response without double posting', async () => {
    const input = {
      idempotencyKey: 'idemp-duplicate-test',
      description: 'Deposit transaction',
      entries: [
        { accountId: 'acc-cash', direction: 'DEBIT' as const, amount: '5000', currency: 'USD' },
        { accountId: 'acc-deposit', direction: 'CREDIT' as const, amount: '5000', currency: 'USD' },
      ],
    };

    const firstCall = await useCase.execute(input);
    expect(firstCall.isSuccess).toBe(true);
    const firstOutput = firstCall.getValue();

    // Second call with same idempotency key
    const secondCall = await useCase.execute(input);
    expect(secondCall.isSuccess).toBe(true);
    const secondOutput = secondCall.getValue();

    // Outputs must match exactly
    expect(secondOutput.transactionId).toBe(firstOutput.transactionId);
    expect(secondOutput.postedAt).toBe(firstOutput.postedAt);

    // Balance should have changed only ONCE (+5000n, not +10000n)
    const cash = (await ledgerRepo.findAccountById('acc-cash'))!;
    expect(cash.balance.amount).toBe(105000n);
  });

  it('should reject transaction when accounts violate overdraft limit', async () => {
    const input = {
      idempotencyKey: 'idemp-overdraft',
      description: 'Attempt to withdraw $2,000 from $1,000 account',
      entries: [
        {
          accountId: 'acc-cash',
          direction: 'CREDIT' as const, // Credit reduces Asset
          amount: '200000', // $2,000.00
          currency: 'USD',
        },
        {
          accountId: 'acc-deposit',
          direction: 'DEBIT' as const,
          amount: '200000',
          currency: 'USD',
        },
      ],
    };

    const result = await useCase.execute(input);
    expect(result.isFailure).toBe(true);
    expect(result.getError().message).toContain('insufficient funds');

    // Balance must be unchanged
    const cash = (await ledgerRepo.findAccountById('acc-cash'))!;
    expect(cash.balance.amount).toBe(100000n);
  });
});
