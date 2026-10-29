import { Result } from '../../common/domain/result.js';
import { IUnitOfWork } from './ports/unit-of-work.port.js';
import { IIdempotencyStore } from './ports/idempotency-store.port.js';
import { PostTransactionInput, PostTransactionOutput } from './dtos/post-transaction.dto.js';
export declare class PostTransactionUseCase {
    private readonly unitOfWork;
    private readonly idempotencyStore;
    constructor(unitOfWork: IUnitOfWork, idempotencyStore: IIdempotencyStore);
    execute(input: PostTransactionInput): Promise<Result<PostTransactionOutput, Error>>;
}
//# sourceMappingURL=post-transaction.usecase.d.ts.map