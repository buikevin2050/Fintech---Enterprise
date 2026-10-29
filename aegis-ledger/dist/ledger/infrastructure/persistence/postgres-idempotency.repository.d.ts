import pg from 'pg';
import { IIdempotencyStore, IdempotencyRecord } from '../../usecases/ports/idempotency-store.port.js';
export declare class PostgresIdempotencyRepository implements IIdempotencyStore {
    private readonly pool;
    constructor(pool: pg.Pool);
    acquire(key: string, requestHash: string, ttlSeconds?: number): Promise<'ACQUIRED' | 'EXISTS'>;
    get(key: string): Promise<IdempotencyRecord | null>;
    complete(key: string, responsePayload: unknown, transactionId?: string): Promise<void>;
    fail(key: string, errorReason: string): Promise<void>;
}
//# sourceMappingURL=postgres-idempotency.repository.d.ts.map