import pg from 'pg';
import { IUnitOfWork } from '../../usecases/ports/unit-of-work.port.js';
import { ILedgerRepository } from '../../usecases/ports/ledger-repository.port.js';
import { PostgresLedgerRepository } from './postgres-ledger.repository.js';

export class PostgresUnitOfWork implements IUnitOfWork {
  constructor(private readonly pool: pg.Pool) {}

  public async execute<T>(
    work: (repositories: { ledgerRepo: ILedgerRepository }) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      const ledgerRepo = new PostgresLedgerRepository(client);
      const result = await work({ ledgerRepo });

      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('[PostgresUnitOfWork] Rollback error:', rollbackErr);
      }
      throw error;
    } finally {
      client.release();
    }
  }
}
