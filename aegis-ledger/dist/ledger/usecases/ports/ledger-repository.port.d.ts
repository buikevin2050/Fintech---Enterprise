import { Account } from '../../domain/entities/account.entity.js';
import { Transaction } from '../../domain/entities/transaction.entity.js';
export interface ILedgerRepository {
    findAccountById(id: string, lock?: boolean): Promise<Account | null>;
    findAccountsByIds(ids: string[], lock?: boolean): Promise<Account[]>;
    saveAccount(account: Account): Promise<void>;
    updateAccountBalance(account: Account): Promise<void>;
    saveTransaction(transaction: Transaction): Promise<void>;
    findTransactionById(id: string): Promise<Transaction | null>;
    findTransactionByIdempotencyKey(key: string): Promise<Transaction | null>;
}
//# sourceMappingURL=ledger-repository.port.d.ts.map