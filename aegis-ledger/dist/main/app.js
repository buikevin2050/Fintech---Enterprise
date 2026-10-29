import fastify from 'fastify';
import cors from '@fastify/cors';
import sensible from '@fastify/sensible';
import { PostgresPool } from '../ledger/infrastructure/database/postgres-pool.js';
import { PostgresLedgerRepository } from '../ledger/infrastructure/persistence/postgres-ledger.repository.js';
import { PostgresUnitOfWork } from '../ledger/infrastructure/persistence/postgres-unit-of-work.js';
import { PostgresIdempotencyRepository } from '../ledger/infrastructure/persistence/postgres-idempotency.repository.js';
import { PostTransactionUseCase } from '../ledger/usecases/post-transaction.usecase.js';
import { ReverseTransactionUseCase } from '../ledger/usecases/reverse-transaction.usecase.js';
import { GetAccountBalanceUseCase } from '../ledger/usecases/get-balance.usecase.js';
import { TransactionController } from '../ledger/delivery/http/transaction.controller.js';
import { createTransactionRouter } from '../ledger/delivery/http/transaction.router.js';
export function buildApp(config, dependencies = {}) {
    const app = fastify({
        logger: {
            level: config.LOG_LEVEL,
        },
    });
    // Register Global Middlewares
    app.register(cors, { origin: true });
    app.register(sensible);
    // Health Check Endpoint
    app.get('/health', async () => {
        return {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            service: 'aegis-ledger',
            version: '1.0.0',
        };
    });
    // Database Connection Pool
    const pool = dependencies.pool ??
        PostgresPool.initialize({
            connectionString: config.DATABASE_URL,
            host: config.DB_HOST,
            port: config.DB_PORT,
            user: config.DB_USER,
            password: config.DB_PASSWORD,
            database: config.DB_NAME,
            max: config.DB_POOL_MAX,
            idleTimeoutMillis: config.DB_IDLE_TIMEOUT_MS,
            statementTimeout: config.DB_STATEMENT_TIMEOUT_MS,
        });
    // Composition Root: Dependency Injection Wiring
    const ledgerRepository = new PostgresLedgerRepository(pool);
    const unitOfWork = new PostgresUnitOfWork(pool);
    const idempotencyStore = new PostgresIdempotencyRepository(pool);
    const postTransactionUseCase = new PostTransactionUseCase(unitOfWork, idempotencyStore);
    const reverseTransactionUseCase = new ReverseTransactionUseCase(unitOfWork, idempotencyStore);
    const getAccountBalanceUseCase = new GetAccountBalanceUseCase(ledgerRepository);
    const transactionController = new TransactionController(postTransactionUseCase, reverseTransactionUseCase, getAccountBalanceUseCase);
    // Register API Routes
    app.register(createTransactionRouter(transactionController), { prefix: '/v1' });
    return app;
}
//# sourceMappingURL=app.js.map