import { ValueObject } from '../../../common/domain/value-object.js';
import { Result } from '../../../common/domain/result.js';
interface CurrencyProps {
    code: string;
    decimals: number;
}
export declare class Currency extends ValueObject<CurrencyProps> {
    private constructor();
    get code(): string;
    get decimals(): number;
    static create(code: string, decimals?: number): Result<Currency>;
    static USD(): Currency;
    static EUR(): Currency;
    static JPY(): Currency;
    static GBP(): Currency;
}
export {};
//# sourceMappingURL=currency.vo.d.ts.map