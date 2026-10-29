import { Entity } from '../../../common/domain/entity.js';
import { Result } from '../../../common/domain/result.js';
import { Money } from '../value-objects/money.vo.js';
import { InvalidEntryError } from '../exceptions/ledger.exceptions.js';
export type EntryDirection = 'DEBIT' | 'CREDIT';
export interface EntryProps {
    transactionId: string;
    accountId: string;
    direction: EntryDirection;
    amount: Money;
    sequence: number;
    description?: string | undefined;
    createdAt: Date;
}
export declare class Entry extends Entity<EntryProps> {
    private constructor();
    get transactionId(): string;
    get accountId(): string;
    get direction(): EntryDirection;
    get amount(): Money;
    get sequence(): number;
    get description(): string | undefined;
    get createdAt(): Date;
    static create(props: Omit<EntryProps, 'createdAt'> & {
        createdAt?: Date;
    }, id: string): Result<Entry, InvalidEntryError>;
}
//# sourceMappingURL=entry.entity.d.ts.map