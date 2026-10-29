import pg from 'pg';
import { IUnitOfWork } from '../../usecases/ports/unit-of-work.port.js';
import { ILedgerRepository } from '../../usecases/ports/ledger-repository.port.js';
export declare class PostgresUnitOfWork implements IUnitOfWork {
    private readonly pool;
    constructor(pool: pg.Pool);
    execute<T>(work: (repositories: {
        ledgerRepo: ILedgerRepository;
    }) => Promise<T>): Promise<T>;
}
//# sourceMappingURL=postgres-unit-of-work.d.ts.map