import pg from 'pg';
import { ILedgerRepository } from '../../usecases/ports/ledger-repository.port.js';
import { Account } from '../../domain/entities/account.entity.js';
import { Transaction } from '../../domain/entities/transaction.entity.js';
export declare class PostgresLedgerRepository implements ILedgerRepository {
    private readonly client;
    constructor(client: pg.PoolClient | pg.Pool);
    findAccountById(id: string, lock?: boolean): Promise<Account | null>;
    findAccountsByIds(ids: string[], lock?: boolean): Promise<Account[]>;
    saveAccount(account: Account): Promise<void>;
    updateAccountBalance(account: Account): Promise<void>;
    saveTransaction(transaction: Transaction): Promise<void>;
    findTransactionById(id: string): Promise<Transaction | null>;
    findTransactionByIdempotencyKey(key: string): Promise<Transaction | null>;
    private mapToAccountEntity;
}
//# sourceMappingURL=postgres-ledger.repository.d.ts.map