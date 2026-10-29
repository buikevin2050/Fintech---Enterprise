export class PostgresIdempotencyRepository {
    pool;
    constructor(pool) {
        this.pool = pool;
    }
    async acquire(key, requestHash, ttlSeconds = 86400) {
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
    async get(key) {
        const query = `
      SELECT key, request_hash, status, response_payload, transaction_id, created_at, expires_at
      FROM idempotency_keys
      WHERE key = $1
    `;
        const res = await this.pool.query(query, [key]);
        if (res.rows.length === 0) {
            return null;
        }
        const row = res.rows[0];
        return {
            key: row.key,
            requestHash: row.request_hash,
            status: row.status,
            responsePayload: row.response_payload,
            transactionId: row.transaction_id ?? undefined,
            createdAt: row.created_at,
            expiresAt: row.expires_at,
        };
    }
    async complete(key, responsePayload, transactionId) {
        const query = `
      UPDATE idempotency_keys
      SET status = 'COMPLETED', response_payload = $1, transaction_id = $2
      WHERE key = $3
    `;
        await this.pool.query(query, [JSON.stringify(responsePayload), transactionId ?? null, key]);
    }
    async fail(key, errorReason) {
        const query = `
      UPDATE idempotency_keys
      SET status = 'FAILED', error_reason = $1
      WHERE key = $2
    `;
        await this.pool.query(query, [errorReason, key]);
    }
}
//# sourceMappingURL=postgres-idempotency.repository.js.map