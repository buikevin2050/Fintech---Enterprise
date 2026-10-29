import pg from 'pg';

const { Pool } = pg;

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

export class PostgresPool {
  private static instance: pg.Pool | null = null;

  public static initialize(config: DatabaseConfig): pg.Pool {
    if (this.instance) {
      return this.instance;
    }

    const poolConfig: pg.PoolConfig = config.connectionString
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

  public static getInstance(): pg.Pool {
    if (!this.instance) {
      throw new Error('PostgresPool has not been initialized. Call initialize() first.');
    }
    return this.instance;
  }

  public static async close(): Promise<void> {
    if (this.instance) {
      await this.instance.end();
      this.instance = null;
    }
  }
}
