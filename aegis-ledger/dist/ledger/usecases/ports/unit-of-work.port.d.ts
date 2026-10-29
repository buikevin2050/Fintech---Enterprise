import { ILedgerRepository } from './ledger-repository.port.js';
export interface IUnitOfWork {
    execute<T>(work: (repositories: {
        ledgerRepo: ILedgerRepository;
    }) => Promise<T>): Promise<T>;
}
//# sourceMappingURL=unit-of-work.port.d.ts.map