/**
 * Functional Result pattern implementation for robust domain and use case error handling.
 * Eliminates unhandled runtime exceptions and makes failures explicit in method signatures.
 */
export declare class Result<T = void, E = Error> {
    readonly isSuccess: boolean;
    readonly isFailure: boolean;
    private readonly _value;
    private readonly _error;
    private constructor();
    getValue(): T;
    getError(): E;
    static ok<U = void, F = Error>(value?: U | undefined): Result<U, F>;
    static fail<U = void, F = Error>(error: F): Result<U, F>;
    static combine(results: Result<unknown, unknown>[]): Result<void, unknown>;
}
//# sourceMappingURL=result.d.ts.map