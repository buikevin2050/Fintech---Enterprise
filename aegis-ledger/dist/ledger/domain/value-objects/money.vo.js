import { ValueObject } from '../../../common/domain/value-object.js';
import { Result } from '../../../common/domain/result.js';
export class Money extends ValueObject {
    constructor(props) {
        super(props);
    }
    get amount() {
        return this.props.amount;
    }
    get currency() {
        return this.props.currency;
    }
    static create(amount, currency) {
        try {
            let finalAmount;
            if (typeof amount === 'bigint') {
                finalAmount = amount;
            }
            else if (typeof amount === 'number') {
                if (!Number.isInteger(amount)) {
                    return Result.fail(new Error(`Floating point amounts are prohibited to avoid precision loss. Provide integer minor units: ${amount}`));
                }
                finalAmount = BigInt(amount);
            }
            else if (typeof amount === 'string') {
                finalAmount = BigInt(amount.trim());
            }
            else {
                return Result.fail(new Error('Invalid amount type for Money.'));
            }
            return Result.ok(new Money({ amount: finalAmount, currency }));
        }
        catch (err) {
            return Result.fail(new Error(`Failed to parse Money amount: ${err.message}`));
        }
    }
    static zero(currency) {
        return new Money({ amount: 0n, currency });
    }
    static fromDecimal(decimalStr, currency) {
        try {
            const parts = decimalStr.trim().split('.');
            if (parts.length > 2) {
                return Result.fail(new Error(`Invalid decimal format: ${decimalStr}`));
            }
            const integerPart = parts[0] || '0';
            const fractionalPart = parts[1] || '';
            if (fractionalPart.length > currency.decimals) {
                return Result.fail(new Error(`Currency ${currency.code} supports up to ${currency.decimals} decimals, but received ${fractionalPart.length}`));
            }
            const paddedFraction = fractionalPart.padEnd(currency.decimals, '0');
            const isNegative = integerPart.startsWith('-');
            const cleanInt = isNegative ? integerPart.slice(1) : integerPart;
            const totalMinorUnits = BigInt(cleanInt) * 10n ** BigInt(currency.decimals) + BigInt(paddedFraction);
            const signedAmount = isNegative ? -totalMinorUnits : totalMinorUnits;
            return Result.ok(new Money({ amount: signedAmount, currency }));
        }
        catch (err) {
            return Result.fail(new Error(`Failed to parse decimal into Money: ${err.message}`));
        }
    }
    add(other) {
        if (!this.currency.equals(other.currency)) {
            return Result.fail(new Error(`Cannot add money with mismatched currencies: ${this.currency.code} and ${other.currency.code}`));
        }
        return Result.ok(new Money({ amount: this.amount + other.amount, currency: this.currency }));
    }
    subtract(other) {
        if (!this.currency.equals(other.currency)) {
            return Result.fail(new Error(`Cannot subtract money with mismatched currencies: ${this.currency.code} and ${other.currency.code}`));
        }
        return Result.ok(new Money({ amount: this.amount - other.amount, currency: this.currency }));
    }
    multiply(factor) {
        if (typeof factor === 'bigint') {
            return Result.ok(new Money({ amount: this.amount * factor, currency: this.currency }));
        }
        if (Number.isInteger(factor)) {
            return Result.ok(new Money({ amount: this.amount * BigInt(factor), currency: this.currency }));
        }
        return Result.fail(new Error('Multiplication requires an integer scalar to prevent fractional drift.'));
    }
    /**
     * Distributes money according to ratios without losing single minor units (pennies).
     * Remainder cents are allocated one by one to the largest ratio buckets (Largest Remainder Method).
     */
    allocate(ratios) {
        if (ratios.length === 0) {
            return Result.fail(new Error('Cannot allocate to empty ratios.'));
        }
        const totalRatio = ratios.reduce((sum, r) => sum + r, 0);
        if (totalRatio <= 0) {
            return Result.fail(new Error('Total ratio sum must be strictly positive.'));
        }
        const totalBigRatio = BigInt(totalRatio);
        let remainder = this.amount;
        const results = [];
        for (let i = 0; i < ratios.length; i++) {
            const share = (this.amount * BigInt(ratios[i])) / totalBigRatio;
            results.push(share);
            remainder -= share;
        }
        // Distribute remainder minor units
        for (let i = 0; i < Number(remainder); i++) {
            results[i % results.length] = (results[i % results.length] ?? 0n) + 1n;
        }
        const moneys = results.map((val) => new Money({ amount: val, currency: this.currency }));
        return Result.ok(moneys);
    }
    isZero() {
        return this.amount === 0n;
    }
    isPositive() {
        return this.amount > 0n;
    }
    isNegative() {
        return this.amount < 0n;
    }
    greaterThan(other) {
        this.assertSameCurrency(other);
        return this.amount > other.amount;
    }
    lessThan(other) {
        this.assertSameCurrency(other);
        return this.amount < other.amount;
    }
    equals(other) {
        if (!other)
            return false;
        return this.currency.equals(other.currency) && this.amount === other.amount;
    }
    toDecimalString() {
        const decimals = this.currency.decimals;
        if (decimals === 0) {
            return this.amount.toString();
        }
        const isNegative = this.amount < 0n;
        const absAmount = isNegative ? -this.amount : this.amount;
        const divisor = 10n ** BigInt(decimals);
        const intPart = absAmount / divisor;
        const fracPart = absAmount % divisor;
        const fracPadded = fracPart.toString().padStart(decimals, '0');
        return `${isNegative ? '-' : ''}${intPart}.${fracPadded}`;
    }
    assertSameCurrency(other) {
        if (!this.currency.equals(other.currency)) {
            throw new Error(`Currency mismatch: ${this.currency.code} vs ${other.currency.code}`);
        }
    }
}
//# sourceMappingURL=money.vo.js.map