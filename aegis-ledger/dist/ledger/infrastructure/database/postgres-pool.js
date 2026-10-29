import pg from 'pg';
const { Pool } = pg;
export class PostgresPool {
    static instance = null;
    static initialize(config) {
        if (this.instance) {
            return this.instance;
        }
        const poolConfig = config.connectionString
            ? {
                connectionString: config.connectionString,
                max: config.max ?? 20,
                idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
                connectionTimeoutMillis: config.connectionTimeoutMillis ?? 5000,
                statement_timeout: config.statementTimeout ?? 10000,
            }
            : {
                host: config.host ?? 'localhost',
                port: config.port ?? 5432,
                user: config.user ?? 'postgres',
                password: config.password ?? 'postgres',
                database: config.database ?? 'aegis_ledger',
                max: config.max ?? 20,
                idleTimeoutMillis: config.idleTimeoutMillis ?? 30000,
                connectionTimeoutMillis: config.connectionTimeoutMillis ?? 5000,
                statement_timeout: config.statementTimeout ?? 10000,
            };
        this.instance = new Pool(poolConfig);
        this.instance.on('error', (err) => {
            console.error('[PostgresPool] Unexpected idle client error:', err);
        });
        return this.instance;
    }
    static getInstance() {
        if (!this.instance) {
            throw new Error('PostgresPool has not been initialized. Call initialize() first.');
        }
        return this.instance;
    }
    static async close() {
        if (this.instance) {
            await this.instance.end();
            this.instance = null;
        }
    }
}
//# sourceMappingURL=postgres-pool.js.map