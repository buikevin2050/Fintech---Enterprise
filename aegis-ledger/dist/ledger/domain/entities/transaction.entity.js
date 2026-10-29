import { AggregateRoot } from '../../../common/domain/aggregate-root.js';
import { Result } from '../../../common/domain/result.js';
import { Entry } from './entry.entity.js';
import { UnbalancedTransactionError, TransactionAlreadyPostedError, InvalidEntryError, } from '../exceptions/ledger.exceptions.js';
export class TransactionPostedEvent {
    aggregateId;
    idempotencyKey;
    entriesCount;
    type;
    eventName = 'TransactionPostedEvent';
    dateTimeOccurred;
    constructor(aggregateId, idempotencyKey, entriesCount, type) {
        this.aggregateId = aggregateId;
        this.idempotencyKey = idempotencyKey;
        this.entriesCount = entriesCount;
        this.type = type;
        this.dateTimeOccurred = new Date();
    }
}
export class TransactionReversedEvent {
    aggregateId;
    originalTransactionId;
    reversalTransactionId;
    eventName = 'TransactionReversedEvent';
    dateTimeOccurred;
    constructor(aggregateId, originalTransactionId, reversalTransactionId) {
        this.aggregateId = aggregateId;
        this.originalTransactionId = originalTransactionId;
        this.reversalTransactionId = reversalTransactionId;
        this.dateTimeOccurred = new Date();
    }
}
export class Transaction extends AggregateRoot {
    constructor(props, id) {
        super(props, id);
    }
    get idempotencyKey() {
        return this.props.idempotencyKey;
    }
    get type() {
        return this.props.type;
    }
    get status() {
        return this.props.status;
    }
    get description() {
        return this.props.description;
    }
    get reversesTransactionId() {
        return this.props.reversesTransactionId;
    }
    get entries() {
        return [...this.props.entries];
    }
    get postedAt() {
        return this.props.postedAt;
    }
    get createdAt() {
        return this.props.createdAt;
    }
    /**
     * Factory method to construct and validate a new Transaction aggregate.
     */
    static create(props, id) {
        if (!props.idempotencyKey || props.idempotencyKey.trim().length === 0) {
            return Result.fail(new Error('Idempotency key is required for all transactions.'));
        }
        if (!props.description || props.description.trim().length === 0) {
            return Result.fail(new Error('Transaction description is required for audit trail.'));
        }
        if (!props.entries || props.entries.length < 2) {
            return Result.fail(new InvalidEntryError('A double-entry transaction must contain at least 2 entries.'));
        }
        // Verify double-entry balance invariant per currency: Sum(DEBITS) === Sum(CREDITS)
        const currencyDebitTotals = new Map();
        const currencyCreditTotals = new Map();
        for (const entry of props.entries) {
            const currCode = entry.amount.currency.code;
            const currentDebit = currencyDebitTotals.get(currCode) ?? 0n;
            const currentCredit = currencyCreditTotals.get(currCode) ?? 0n;
            if (entry.direction === 'DEBIT') {
                currencyDebitTotals.set(currCode, currentDebit + entry.amount.amount);
            }
            else {
                currencyCreditTotals.set(currCode, currentCredit + entry.amount.amount);
            }
        }
        const allCurrencies = new Set([...currencyDebitTotals.keys(), ...currencyCreditTotals.keys()]);
        for (const currCode of allCurrencies) {
            const debitTotal = currencyDebitTotals.get(currCode) ?? 0n;
            const creditTotal = currencyCreditTotals.get(currCode) ?? 0n;
            if (debitTotal !== creditTotal) {
                return Result.fail(new UnbalancedTransactionError(debitTotal, creditTotal, currCode));
            }
        }
        const transaction = new Transaction({
            idempotencyKey: props.idempotencyKey.trim(),
            description: props.description.trim(),
            type: props.type ?? 'STANDARD',
            reversesTransactionId: props.reversesTransactionId,
            entries: props.entries,
            status: props.status ?? 'DRAFT',
            postedAt: props.postedAt,
            createdAt: props.createdAt ?? new Date(),
        }, id);
        return Result.ok(transaction);
    }
    /**
     * Finalizes and posts the transaction. Once posted, it becomes completely immutable.
     */
    post() {
        if (this.props.status === 'POSTED') {
            return Result.fail(new TransactionAlreadyPostedError(this.id));
        }
        this.props.status = 'POSTED';
        this.props.postedAt = new Date();
        this.addDomainEvent(new TransactionPostedEvent(this.id, this.idempotencyKey, this.props.entries.length, this.type));
        return Result.ok();
    }
    /**
     * Generates a mirror reversal transaction adhering to append-only ledger rules.
     * Swaps DEBIT and CREDIT on every entry and links back to this transaction ID.
     */
    createReversal(reversalId, newIdempotencyKey, reversalDescription) {
        if (this.props.status !== 'POSTED') {
            return Result.fail(new Error(`Cannot reverse transaction ${this.id} that is not POSTED.`));
        }
        const reversedEntries = [];
        for (let i = 0; i < this.props.entries.length; i++) {
            const orig = this.props.entries[i];
            const invertedDirection = orig.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT';
            const entryResult = Entry.create({
                transactionId: reversalId,
                accountId: orig.accountId,
                direction: invertedDirection,
                amount: orig.amount,
                sequence: i,
                description: `Reversal of entry ${orig.id} from tx ${this.id}`,
            }, `rev-entry-${reversalId}-${i}`);
            if (entryResult.isFailure) {
                return Result.fail(entryResult.getError());
            }
            reversedEntries.push(entryResult.getValue());
        }
        const reversalTxResult = Transaction.create({
            idempotencyKey: newIdempotencyKey,
            description: reversalDescription ?? `Reversal of transaction ${this.id}`,
            type: 'REVERSAL',
            reversesTransactionId: this.id,
            entries: reversedEntries,
            status: 'DRAFT',
        }, reversalId);
        if (reversalTxResult.isFailure) {
            return Result.fail(reversalTxResult.getError());
        }
        // Mark current transaction as reversed
        this.props.status = 'REVERSED';
        this.addDomainEvent(new TransactionReversedEvent(this.id, this.id, reversalId));
        return Result.ok(reversalTxResult.getValue());
    }
}
//# sourceMappingURL=transaction.entity.js.map