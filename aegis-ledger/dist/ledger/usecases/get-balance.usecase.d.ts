import { Result } from '../../common/domain/result.js';
import { ILedgerRepository } from './ports/ledger-repository.port.js';
import { GetAccountBalanceInput, GetAccountBalanceOutput } from './dtos/get-balance.dto.js';
export declare class GetAccountBalanceUseCase {
    private readonly ledgerRepository;
    constructor(ledgerRepository: ILedgerRepository);
    execute(input: GetAccountBalanceInput): Promise<Result<GetAccountBalanceOutput, Error>>;
}
//# sourceMappingURL=get-balance.usecase.d.ts.map