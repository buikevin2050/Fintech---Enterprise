import { Entity } from '../../../common/domain/entity.js';
import { Result } from '../../../common/domain/result.js';
import { InvalidEntryError } from '../exceptions/ledger.exceptions.js';
export class Entry extends Entity {
    constructor(props, id) {
        super(props, id);
    }
    get transactionId() {
        return this.props.transactionId;
    }
    get accountId() {
        return this.props.accountId;
    }
    get direction() {
        return this.props.direction;
    }
    get amount() {
        return this.props.amount;
    }
    get sequence() {
        return this.props.sequence;
    }
    get description() {
        return this.props.description;
    }
    get createdAt() {
        return this.props.createdAt;
    }
    static create(props, id) {
        if (!props.transactionId || props.transactionId.trim() === '') {
            return Result.fail(new InvalidEntryError('Transaction ID is required.'));
        }
        if (!props.accountId || props.accountId.trim() === '') {
            return Result.fail(new InvalidEntryError('Account ID is required.'));
        }
        if (props.direction !== 'DEBIT' && props.direction !== 'CREDIT') {
            return Result.fail(new InvalidEntryError('Direction must be either DEBIT or CREDIT.'));
        }
        if (!props.amount.isPositive()) {
            return Result.fail(new InvalidEntryError(`Entry amount must be strictly positive (> 0). Received: ${props.amount.amount.toString()}`));
        }
        if (props.sequence < 0 || !Number.isInteger(props.sequence)) {
            return Result.fail(new InvalidEntryError('Sequence must be a non-negative integer.'));
        }
        const entry = new Entry({
            ...props,
            createdAt: props.createdAt ?? new Date(),
        }, id);
        return Result.ok(entry);
    }
}
//# sourceMappingURL=entry.entity.js.map