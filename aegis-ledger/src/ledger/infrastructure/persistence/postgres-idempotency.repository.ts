import pg from 'pg';
import { IIdempotencyStore, IdempotencyRecord, IdempotencyStatus } from '../../usecases/ports/idempotency-store.port.js';

interface IdempotencyRow {
  key: string;
  request_hash: string;
  status: string;
  response_payload: unknown;
  transaction_id: string | null;
  created_at: Date;
  expires_at: Date;
}

export class PostgresIdempotencyRepository implements IIdempotencyStore {
  constructor(private readonly pool: pg.Pool) {}

  public async acquire(
    key: string,
    requestHash: string,
    ttlSeconds: number = 86400
  ): Promise<'ACQUIRED' | 'EXISTS'> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);

    const query = `
      INSERT INTO idempotency_keys (key, request_hash, status, expires_at)
      VALUES ($1, $2, 'PROCESSING', $3)
      ON CONFLICT (key) DO NOTHING
    `;

    const res = await this.pool.query(query, [key, requestHash, expiresAt]);
    if (res.rowCount && res.rowCount > 0) {
      return 'ACQUIRED';
    }

    return 'EXISTS';
  }

  public async get(key: string): Promise<IdempotencyRecord | null> {
    const query = `
      SELECT key, request_hash, status, response_payload, transaction_id, created_at, expires_at
      FROM idempotency_keys
      WHERE key = $1
    `;

    const res = await this.pool.query<IdempotencyRow>(query, [key]);
    if (res.rows.length === 0) {
      return null;
    }

    const row = res.rows[0]!;
    return {
      key: row.key,
      requestHash: row.request_hash,
      status: row.status as IdempotencyStatus,
      responsePayload: row.response_payload,
      transactionId: row.transaction_id ?? undefined,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    };
  }

  public async complete(key: string, responsePayload: unknown, transactionId?: string): Promise<void> {
    const query = `
      UPDATE idempotency_keys
      SET status = 'COMPLETED', response_payload = $1, transaction_id = $2
      WHERE key = $3
    `;

    await this.pool.query(query, [JSON.stringify(responsePayload), transactionId ?? null, key]);
  }

  public async fail(key: string, errorReason: string): Promise<void> {
    const query = `
      UPDATE idempotency_keys
      SET status = 'FAILED', error_reason = $1
      WHERE key = $2
    `;

    await this.pool.query(query, [errorReason, key]);
  }
}
