import { Entity } from '../../../common/domain/entity.js';
import { Result } from '../../../common/domain/result.js';
import { Money } from '../value-objects/money.vo.js';
import { Currency } from '../value-objects/currency.vo.js';
import { AccountFrozenError, InsufficientFundsError } from '../exceptions/ledger.exceptions.js';
import { Entry } from './entry.entity.js';
export type AccountType = 'ASSET' | 'LIABILITY' | 'EQUITY' | 'REVENUE' | 'EXPENSE';
export type AccountStatus = 'ACTIVE' | 'FROZEN' | 'CLOSED';
export interface AccountProps {
    code: string;
    name: string;
    type: AccountType;
    currency: Currency;
    balance: Money;
    status: AccountStatus;
    allowNegativeBalance: boolean;
    version: number;
    createdAt: Date;
    updatedAt: Date;
}
export declare class Account extends Entity<AccountProps> {
    private constructor();
    get code(): string;
    get name(): string;
    get type(): AccountType;
    get currency(): Currency;
    get balance(): Money;
    get status(): AccountStatus;
    get allowNegativeBalance(): boolean;
    get version(): number;
    get createdAt(): Date;
    get updatedAt(): Date;
    isNormalDebit(): boolean;
    isNormalCredit(): boolean;
    applyEntry(entry: Entry): Result<Account, AccountFrozenError | InsufficientFundsError | Error>;
    freeze(): void;
    unfreeze(): void;
    static create(props: {
        code: string;
        name: string;
        type: AccountType;
        currency: Currency;
        allowNegativeBalance?: boolean;
        status?: AccountStatus;
        initialBalance?: Money;
        version?: number;
        createdAt?: Date;
        updatedAt?: Date;
    }, id: string): Result<Account>;
}
//# sourceMappingURL=account.entity.d.ts.map