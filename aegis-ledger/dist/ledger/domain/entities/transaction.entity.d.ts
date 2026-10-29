import { AggregateRoot, IDomainEvent } from '../../../common/domain/aggregate-root.js';
import { Result } from '../../../common/domain/result.js';
import { Entry } from './entry.entity.js';
import { UnbalancedTransactionError, TransactionAlreadyPostedError, InvalidEntryError } from '../exceptions/ledger.exceptions.js';
export type TransactionStatus = 'DRAFT' | 'POSTED' | 'REVERSED';
export type TransactionType = 'STANDARD' | 'REVERSAL';
export interface TransactionProps {
    idempotencyKey: string;
    type: TransactionType;
    status: TransactionStatus;
    description: string;
    reversesTransactionId?: string | undefined;
    entries: Entry[];
    postedAt?: Date | undefined;
    createdAt: Date;
}
export declare class TransactionPostedEvent implements IDomainEvent {
    readonly aggregateId: string;
    readonly idempotencyKey: string;
    readonly entriesCount: number;
    readonly type: TransactionType;
    readonly eventName = "TransactionPostedEvent";
    readonly dateTimeOccurred: Date;
    constructor(aggregateId: string, idempotencyKey: string, entriesCount: number, type: TransactionType);
}
export declare class TransactionReversedEvent implements IDomainEvent {
    readonly aggregateId: string;
    readonly originalTransactionId: string;
    readonly reversalTransactionId: string;
    readonly eventName = "TransactionReversedEvent";
    readonly dateTimeOccurred: Date;
    constructor(aggregateId: string, originalTransactionId: string, reversalTransactionId: string);
}
export declare class Transaction extends AggregateRoot<TransactionProps> {
    private constructor();
    get idempotencyKey(): string;
    get type(): TransactionType;
    get status(): TransactionStatus;
    get description(): string;
    get reversesTransactionId(): string | undefined;
    get entries(): ReadonlyArray<Entry>;
    get postedAt(): Date | undefined;
    get createdAt(): Date;
    /**
     * Factory method to construct and validate a new Transaction aggregate.
     */
    static create(props: {
        idempotencyKey: string;
        description: string;
        type?: TransactionType;
        reversesTransactionId?: string | undefined;
        entries: Entry[];
        status?: TransactionStatus;
        postedAt?: Date | undefined;
        createdAt?: Date;
    }, id: string): Result<Transaction, UnbalancedTransactionError | InvalidEntryError | Error>;
    /**
     * Finalizes and posts the transaction. Once posted, it becomes completely immutable.
     */
    post(): Result<void, TransactionAlreadyPostedError>;
    /**
     * Generates a mirror reversal transaction adhering to append-only ledger rules.
     * Swaps DEBIT and CREDIT on every entry and links back to this transaction ID.
     */
    createReversal(reversalId: string, newIdempotencyKey: string, reversalDescription?: string): Result<Transaction, Error>;
}
//# sourceMappingURL=transaction.entity.d.ts.map