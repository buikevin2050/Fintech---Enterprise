export type IdempotencyStatus = 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface IdempotencyRecord {
  key: string;
  requestHash: string;
  status: IdempotencyStatus;
  responsePayload?: unknown | undefined;
  transactionId?: string | undefined;
  createdAt: Date;
  expiresAt: Date;
}

export interface IIdempotencyStore {
  acquire(key: string, requestHash: string, ttlSeconds?: number): Promise<'ACQUIRED' | 'EXISTS'>;
  get(key: string): Promise<IdempotencyRecord | null>;
  complete(key: string, responsePayload: unknown, transactionId?: string): Promise<void>;
  fail(key: string, errorReason: string): Promise<void>;
}
