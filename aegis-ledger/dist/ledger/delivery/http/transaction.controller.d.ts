import { FastifyRequest, FastifyReply } from 'fastify';
import { PostTransactionUseCase } from '../../usecases/post-transaction.usecase.js';
import { ReverseTransactionUseCase } from '../../usecases/reverse-transaction.usecase.js';
import { GetAccountBalanceUseCase } from '../../usecases/get-balance.usecase.js';
interface PostTransactionBody {
    description: string;
    entries: {
        accountId: string;
        direction: 'DEBIT' | 'CREDIT';
        amount: string;
        currency: string;
        description?: string;
    }[];
}
interface ReverseTransactionBody {
    reason: string;
}
export declare class TransactionController {
    private readonly postTransactionUseCase;
    private readonly reverseTransactionUseCase;
    private readonly getAccountBalanceUseCase;
    constructor(postTransactionUseCase: PostTransactionUseCase, reverseTransactionUseCase: ReverseTransactionUseCase, getAccountBalanceUseCase: GetAccountBalanceUseCase);
    postTransaction: (request: FastifyRequest<{
        Body: PostTransactionBody;
        Headers: {
            "idempotency-key"?: string;
        };
    }>, reply: FastifyReply) => Promise<void>;
    reverseTransaction: (request: FastifyRequest<{
        Params: {
            id: string;
        };
        Body: ReverseTransactionBody;
        Headers: {
            "idempotency-key"?: string;
        };
    }>, reply: FastifyReply) => Promise<void>;
    getBalance: (request: FastifyRequest<{
        Params: {
            id: string;
        };
    }>, reply: FastifyReply) => Promise<void>;
    private mapErrorToStatusCode;
}
export {};
//# sourceMappingURL=transaction.controller.d.ts.map