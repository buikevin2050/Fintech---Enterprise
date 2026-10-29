import { ValueObject } from '../../../common/domain/value-object.js';
import { Result } from '../../../common/domain/result.js';
import { Currency } from './currency.vo.js';

interface MoneyProps {
  amount: bigint;
  currency: Currency;
}

export class Money extends ValueObject<MoneyProps> {
  private constructor(props: MoneyProps) {
    super(props);
  }

  get amount(): bigint {
    return this.props.amount;
  }

  get currency(): Currency {
    return this.props.currency;
  }

  public static create(amount: bigint | number | string, currency: Currency): Result<Money> {
    try {
      let finalAmount: bigint;
      if (typeof amount === 'bigint') {
        finalAmount = amount;
      } else if (typeof amount === 'number') {
        if (!Number.isInteger(amount)) {
          return Result.fail(
            new Error(
              `Floating point amounts are prohibited to avoid precision loss. Provide integer minor units: ${amount}`
            )
          );
        }
        finalAmount = BigInt(amount);
      } else if (typeof amount === 'string') {
        finalAmount = BigInt(amount.trim());
      } else {
        return Result.fail(new Error('Invalid amount type for Money.'));
      }

      return Result.ok(new Money({ amount: finalAmount, currency }));
    } catch (err) {
      return Result.fail(new Error(`Failed to parse Money amount: ${(err as Error).message}`));
    }
  }

  public static zero(currency: Currency): Money {
    return new Money({ amount: 0n, currency });
  }

  public static fromDecimal(decimalStr: string, currency: Currency): Result<Money> {
    try {
      const parts = decimalStr.trim().split('.');
      if (parts.length > 2) {
        return Result.fail(new Error(`Invalid decimal format: ${decimalStr}`));
      }

      const integerPart = parts[0] || '0';
      const fractionalPart = parts[1] || '';

      if (fractionalPart.length > currency.decimals) {
        return Result.fail(
          new Error(
            `Currency ${currency.code} supports up to ${currency.decimals} decimals, but received ${fractionalPart.length}`
          )
        );
      }

      const paddedFraction = fractionalPart.padEnd(currency.decimals, '0');
      const isNegative = integerPart.startsWith('-');
      const cleanInt = isNegative ? integerPart.slice(1) : integerPart;

      const totalMinorUnits = BigInt(cleanInt) * 10n ** BigInt(currency.decimals) + BigInt(paddedFraction);
      const signedAmount = isNegative ? -totalMinorUnits : totalMinorUnits;

      return Result.ok(new Money({ amount: signedAmount, currency }));
    } catch (err) {
      return Result.fail(new Error(`Failed to parse decimal into Money: ${(err as Error).message}`));
    }
  }

  public add(other: Money): Result<Money> {
    if (!this.currency.equals(other.currency)) {
      return Result.fail(
        new Error(`Cannot add money with mismatched currencies: ${this.currency.code} and ${other.currency.code}`)
      );
    }
    return Result.ok(new Money({ amount: this.amount + other.amount, currency: this.currency }));
  }

  public subtract(other: Money): Result<Money> {
    if (!this.currency.equals(other.currency)) {
      return Result.fail(
        new Error(`Cannot subtract money with mismatched currencies: ${this.currency.code} and ${other.currency.code}`)
      );
    }
    return Result.ok(new Money({ amount: this.amount - other.amount, currency: this.currency }));
  }

  public multiply(factor: bigint | number): Result<Money> {
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
  public allocate(ratios: number[]): Result<Money[]> {
    if (ratios.length === 0) {
      return Result.fail(new Error('Cannot allocate to empty ratios.'));
    }

    const totalRatio = ratios.reduce((sum, r) => sum + r, 0);
    if (totalRatio <= 0) {
      return Result.fail(new Error('Total ratio sum must be strictly positive.'));
    }

    const totalBigRatio = BigInt(totalRatio);
    let remainder = this.amount;
    const results: bigint[] = [];

    for (let i = 0; i < ratios.length; i++) {
      const share = (this.amount * BigInt(ratios[i]!)) / totalBigRatio;
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

  public isZero(): boolean {
    return this.amount === 0n;
  }

  public isPositive(): boolean {
    return this.amount > 0n;
  }

  public isNegative(): boolean {
    return this.amount < 0n;
  }

  public greaterThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount > other.amount;
  }

  public lessThan(other: Money): boolean {
    this.assertSameCurrency(other);
    return this.amount < other.amount;
  }

  public override equals(other?: Money): boolean {
    if (!other) return false;
    return this.currency.equals(other.currency) && this.amount === other.amount;
  }

  public toDecimalString(): string {
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

  private assertSameCurrency(other: Money): void {
    if (!this.currency.equals(other.currency)) {
      throw new Error(`Currency mismatch: ${this.currency.code} vs ${other.currency.code}`);
    }
  }
}
