import { ValueObject } from '../../../common/domain/value-object.js';
import { Result } from '../../../common/domain/result.js';
import { Currency } from './currency.vo.js';
interface MoneyProps {
    amount: bigint;
    currency: Currency;
}
export declare class Money extends ValueObject<MoneyProps> {
    private constructor();
    get amount(): bigint;
    get currency(): Currency;
    static create(amount: bigint | number | string, currency: Currency): Result<Money>;
    static zero(currency: Currency): Money;
    static fromDecimal(decimalStr: string, currency: Currency): Result<Money>;
    add(other: Money): Result<Money>;
    subtract(other: Money): Result<Money>;
    multiply(factor: bigint | number): Result<Money>;
    /**
     * Distributes money according to ratios without losing single minor units (pennies).
     * Remainder cents are allocated one by one to the largest ratio buckets (Largest Remainder Method).
     */
    allocate(ratios: number[]): Result<Money[]>;
    isZero(): boolean;
    isPositive(): boolean;
    isNegative(): boolean;
    greaterThan(other: Money): boolean;
    lessThan(other: Money): boolean;
    equals(other?: Money): boolean;
    toDecimalString(): string;
    private assertSameCurrency;
}
export {};
//# sourceMappingURL=money.vo.d.ts.map