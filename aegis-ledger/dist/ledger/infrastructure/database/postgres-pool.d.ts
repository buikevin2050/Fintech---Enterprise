import pg from 'pg';
export interface DatabaseConfig {
    connectionString?: string | undefined;
    host?: string | undefined;
    port?: number | undefined;
    user?: string | undefined;
    password?: string | undefined;
    database?: string | undefined;
    max?: number | undefined;
    idleTimeoutMillis?: number | undefined;
    connectionTimeoutMillis?: number | undefined;
    statementTimeout?: number | undefined;
}
export declare class PostgresPool {
    private static instance;
    static initialize(config: DatabaseConfig): pg.Pool;
    static getInstance(): pg.Pool;
    static close(): Promise<void>;
}
//# sourceMappingURL=postgres-pool.d.ts.map