import { Result } from '../../common/domain/result.js';
import { IUnitOfWork } from './ports/unit-of-work.port.js';
import { IIdempotencyStore } from './ports/idempotency-store.port.js';
import { ReverseTransactionInput, ReverseTransactionOutput } from './dtos/reverse-transaction.dto.js';
export declare class ReverseTransactionUseCase {
    private readonly unitOfWork;
    private readonly idempotencyStore;
    constructor(unitOfWork: IUnitOfWork, idempotencyStore: IIdempotencyStore);
    execute(input: ReverseTransactionInput): Promise<Result<ReverseTransactionOutput, Error>>;
}
//# sourceMappingURL=reverse-transaction.usecase.d.ts.map