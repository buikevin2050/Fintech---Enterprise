import { describe, it, expect, beforeEach } from 'vitest';
import fastify, { FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { TransactionController } from '../../src/ledger/delivery/http/transaction.controller.js';
import { createTransactionRouter } from '../../src/ledger/delivery/http/transaction.router.js';
import { PostTransactionUseCase } from '../../src/ledger/usecases/post-transaction.usecase.js';
import { ReverseTransactionUseCase } from '../../src/ledger/usecases/reverse-transaction.usecase.js';
import { GetAccountBalanceUseCase } from '../../src/ledger/usecases/get-balance.usecase.js';
import { ILedgerRepository } from '../../src/ledger/usecases/ports/ledger-repository.port.js';
import { IUnitOfWork } from '../../src/ledger/usecases/ports/unit-of-work.port.js';
import { IIdempotencyStore, IdempotencyRecord } from '../../src/ledger/usecases/ports/idempotency-store.port.js';
import { Account } from '../../src/ledger/domain/entities/account.entity.js';
import { Transaction } from '../../src/ledger/domain/entities/transaction.entity.js';
import { Currency } from '../../src/ledger/domain/value-objects/currency.vo.js';
import { Money } from '../../src/ledger/domain/value-objects/money.vo.js';

class MockLedgerRepository implements ILedgerRepository {
  public accounts = new Map<string, Account>();
  public transactions = new Map<string, Transaction>();

  async findAccountById(id: string): Promise<Account | null> {
    return this.accounts.get(id) ?? null;
  }

  async findAccountsByIds(ids: string[]): Promise<Account[]> {
    return ids.map((id) => this.accounts.get(id)).filter(Boolean) as Account[];
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

class MockUnitOfWork implements IUnitOfWork {
  constructor(private readonly repo: MockLedgerRepository) {}
  async execute<T>(work: (repos: { ledgerRepo: ILedgerRepository }) => Promise<T>): Promise<T> {
    return work({ ledgerRepo: this.repo });
  }
}

class MockIdempotencyStore implements IIdempotencyStore {
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

  async fail(key: string): Promise<void> {
    const r = this.records.get(key);
    if (r) r.status = 'FAILED';
  }
}

describe('AegisLedger HTTP Delivery & Route Integration', () => {
  let app: FastifyInstance;
  let ledgerRepo: MockLedgerRepository;
  const USD = Currency.USD();

  beforeEach(async () => {
    ledgerRepo = new MockLedgerRepository();
    const uow = new MockUnitOfWork(ledgerRepo);
    const idemp = new MockIdempotencyStore();

    const postTx = new PostTransactionUseCase(uow, idemp);
    const revTx = new ReverseTransactionUseCase(uow, idemp);
    const getBal = new GetAccountBalanceUseCase(ledgerRepo);

    const controller = new TransactionController(postTx, revTx, getBal);

    app = fastify();
    await app.register(cors);
    await app.register(sensible);
    await app.register(createTransactionRouter(controller), { prefix: '/v1' });

    // Seed test accounts
    const cash = Account.create(
      {
        code: '1010',
        name: 'Operating Cash',
        type: 'ASSET',
        currency: USD,
        initialBalance: Money.create(50000n, USD).getValue(),
      },
      'acc-cash-1'
    ).getValue();

    const revenue = Account.create(
      {
        code: '4010',
        name: 'Sales Revenue',
        type: 'REVENUE',
        currency: USD,
        initialBalance: Money.create(50000n, USD).getValue(),
      },
      'acc-rev-1'
    ).getValue();

    await ledgerRepo.saveAccount(cash);
    await ledgerRepo.saveAccount(revenue);
  });

  it('should return 400 Bad Request when Idempotency-Key header is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/transactions',
      payload: {
        description: 'Test payment',
        entries: [
          { accountId: 'acc-cash-1', direction: 'DEBIT', amount: '1000', currency: 'USD' },
          { accountId: 'acc-rev-1', direction: 'CREDIT', amount: '1000', currency: 'USD' },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.message || body.error.message).toContain('idempotency-key');
  });

  it('should successfully post a transaction via HTTP POST /v1/transactions', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/transactions',
      headers: {
        'idempotency-key': 'http-idemp-1',
      },
      payload: {
        description: 'Client subscription payment',
        entries: [
          { accountId: 'acc-cash-1', direction: 'DEBIT', amount: '2500', currency: 'USD' },
          { accountId: 'acc-rev-1', direction: 'CREDIT', amount: '2500', currency: 'USD' },
        ],
      },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('POSTED');
    expect(body.data.idempotencyKey).toBe('http-idemp-1');
  });

  it('should return 422 Unprocessable Entity when transaction is unbalanced', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/v1/transactions',
      headers: {
        'idempotency-key': 'http-unbalanced-1',
      },
      payload: {
        description: 'Unbalanced payment',
        entries: [
          { accountId: 'acc-cash-1', direction: 'DEBIT', amount: '2500', currency: 'USD' },
          { accountId: 'acc-rev-1', direction: 'CREDIT', amount: '1500', currency: 'USD' },
        ],
      },
    });

    expect(response.statusCode).toBe(422);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNBALANCED_TRANSACTION');
  });

  it('should query account balance via GET /v1/accounts/:id/balance', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/v1/accounts/acc-cash-1/balance',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.data.accountId).toBe('acc-cash-1');
    expect(body.data.balanceFormatted).toBe('500.00');
  });
});
