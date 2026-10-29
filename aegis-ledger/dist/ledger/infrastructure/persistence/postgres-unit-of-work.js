import { PostgresLedgerRepository } from './postgres-ledger.repository.js';
export class PostgresUnitOfWork {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async execute(work) {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const ledgerRepo = new PostgresLedgerRepository(client);
            const result = await work({ ledgerRepo });
            await client.query('COMMIT');
            return result;
        }
        catch (error) {
            try {
                await client.query('ROLLBACK');
            }
            catch (rollbackErr) {
                console.error('[PostgresUnitOfWork] Rollback error:', rollbackErr);
            }
            throw error;
        }
        finally {
            client.release();
        }
    }
}
//# sourceMappingURL=postgres-unit-of-work.js.map