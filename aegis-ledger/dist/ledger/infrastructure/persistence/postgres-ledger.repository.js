import { Account } from '../../domain/entities/account.entity.js';
import { Transaction } from '../../domain/entities/transaction.entity.js';
import { Entry } from '../../domain/entities/entry.entity.js';
import { Currency } from '../../domain/value-objects/currency.vo.js';
import { Money } from '../../domain/value-objects/money.vo.js';
export class PostgresLedgerRepository {
    client;
    constructor(client) {
        this.client = client;
    }
    async findAccountById(id, lock = false) {
        const query = `
      SELECT id, code, name, type, currency, balance, status, allow_negative_balance, version, created_at, updated_at
      FROM accounts
      WHERE id = $1
      ${lock ? 'FOR UPDATE' : ''}
    `;
        const res = await this.client.query(query, [id]);
        if (res.rows.length === 0) {
            return null;
        }
        return this.mapToAccountEntity(res.rows[0]);
    }
    async findAccountsByIds(ids, lock = false) {
        if (ids.length === 0) {
            return [];
        }
        // Sort IDs deterministically in ascending order to prevent deadlocks
        const sortedIds = [...new Set(ids)].sort();
        const query = `
      SELECT id, code, name, type, currency, balance, status, allow_negative_balance, version, created_at, updated_at
      FROM accounts
      WHERE id = ANY($1)
      ORDER BY id ASC
      ${lock ? 'FOR UPDATE' : ''}
    `;
        const res = await this.client.query(query, [sortedIds]);
        return res.rows.map((row) => this.mapToAccountEntity(row));
    }
    async saveAccount(account) {
        const query = `
      INSERT INTO accounts (
        id, code, name, type, currency, balance, status, allow_negative_balance, version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id) DO UPDATE SET
        code = EXCLUDED.code,
        name = EXCLUDED.name,
        type = EXCLUDED.type,
        currency = EXCLUDED.currency,
        balance = EXCLUDED.balance,
        status = EXCLUDED.status,
        allow_negative_balance = EXCLUDED.allow_negative_balance,
        version = EXCLUDED.version,
        updated_at = EXCLUDED.updated_at
    `;
        await this.client.query(query, [
            account.id,
            account.code,
            account.name,
            account.type,
            account.currency.code,
            account.balance.amount.toString(),
            account.status,
            account.allowNegativeBalance,
            account.version,
            account.createdAt,
            account.updatedAt,
        ]);
    }
    async updateAccountBalance(account) {
        const query = `
      UPDATE accounts
      SET balance = $1, version = $2, updated_at = $3
      WHERE id = $4
    `;
        const res = await this.client.query(query, [
            account.balance.amount.toString(),
            account.version,
            account.updatedAt,
            account.id,
        ]);
        if (res.rowCount === 0) {
            throw new Error(`Failed to update account balance. Account ${account.id} not found.`);
        }
    }
    async saveTransaction(transaction) {
        // 1. Insert Transaction Header
        const txQuery = `
      INSERT INTO transactions (
        id, idempotency_key, type, status, description, reverses_transaction_id, posted_at, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (id) DO UPDATE SET
        status = EXCLUDED.status,
        posted_at = EXCLUDED.posted_at
    `;
        await this.client.query(txQuery, [
            transaction.id,
            transaction.idempotencyKey,
            transaction.type,
            transaction.status,
            transaction.description,
            transaction.reversesTransactionId ?? null,
            transaction.postedAt ?? null,
            transaction.createdAt,
        ]);
        // 2. Insert Append-Only Entries (Journal Lines)
        for (const entry of transaction.entries) {
            const entryQuery = `
        INSERT INTO entries (
          id, transaction_id, account_id, direction, amount, sequence, description, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING
      `;
            await this.client.query(entryQuery, [
                entry.id,
                entry.transactionId,
                entry.accountId,
                entry.direction,
                entry.amount.amount.toString(),
                entry.sequence,
                entry.description ?? null,
                entry.createdAt,
            ]);
        }
    }
    async findTransactionById(id) {
        const txRes = await this.client.query(`SELECT id, idempotency_key, type, status, description, reverses_transaction_id, posted_at, created_at
       FROM transactions WHERE id = $1`, [id]);
        if (txRes.rows.length === 0) {
            return null;
        }
        const txRow = txRes.rows[0];
        const entriesRes = await this.client.query(`SELECT e.id, e.transaction_id, e.account_id, e.direction, e.amount, e.sequence, e.description, e.created_at, a.currency
       FROM entries e
       JOIN accounts a ON e.account_id = a.id
       WHERE e.transaction_id = $1
       ORDER BY e.sequence ASC`, [id]);
        const entries = [];
        for (const er of entriesRes.rows) {
            const currency = Currency.create(er.currency).getValue();
            const money = Money.create(BigInt(er.amount), currency).getValue();
            const entryRes = Entry.create({
                transactionId: er.transaction_id,
                accountId: er.account_id,
                direction: er.direction,
                amount: money,
                sequence: er.sequence,
                description: er.description ?? undefined,
                createdAt: er.created_at,
            }, er.id);
            entries.push(entryRes.getValue());
        }
        const tx = Transaction.create({
            idempotencyKey: txRow.idempotency_key,
            description: txRow.description,
            type: txRow.type,
            reversesTransactionId: txRow.reverses_transaction_id ?? undefined,
            entries,
            status: txRow.status,
            postedAt: txRow.posted_at ?? undefined,
            createdAt: txRow.created_at,
        }, txRow.id);
        return tx.getValue();
    }
    async findTransactionByIdempotencyKey(key) {
        const txRes = await this.client.query(`SELECT id FROM transactions WHERE idempotency_key = $1`, [key]);
        if (txRes.rows.length === 0) {
            return null;
        }
        return this.findTransactionById(txRes.rows[0].id);
    }
    mapToAccountEntity(row) {
        const currency = Currency.create(row.currency).getValue();
        const balance = Money.create(BigInt(row.balance), currency).getValue();
        const accountRes = Account.create({
            code: row.code,
            name: row.name,
            type: row.type,
            currency,
            initialBalance: balance,
            status: row.status,
            allowNegativeBalance: row.allow_negative_balance,
            version: row.version,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
        }, row.id);
        return accountRes.getValue();
    }
}
//# sourceMappingURL=postgres-ledger.repository.js.map