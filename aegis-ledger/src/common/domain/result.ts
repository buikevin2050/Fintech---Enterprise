/**
 * Functional Result pattern implementation for robust domain and use case error handling.
 * Eliminates unhandled runtime exceptions and makes failures explicit in method signatures.
 */
export class Result<T = void, E = Error> {
  public readonly isSuccess: boolean;
  public readonly isFailure: boolean;
  private readonly _value: T | undefined;
  private readonly _error: E | undefined;

  private constructor(isSuccess: boolean, error?: E | undefined, value?: T | undefined) {
    this.isSuccess = isSuccess;
    this.isFailure = !isSuccess;
    this._value = value;
    this._error = error;
    Object.freeze(this);
  }

  public getValue(): T {
    if (!this.isSuccess) {
      throw new Error(
        `Cannot retrieve value from a failed Result. Error: ${JSON.stringify(this._error)}`
      );
    }
    return this._value as T;
  }

  public getError(): E {
    if (this.isSuccess) {
      throw new Error('Cannot retrieve error from a successful Result.');
    }
    return this._error as E;
  }

  public static ok<U = void, F = Error>(value?: U | undefined): Result<U, F> {
    return new Result<U, F>(true, undefined, value);
  }

  public static fail<U = void, F = Error>(error: F): Result<U, F> {
    return new Result<U, F>(false, error, undefined);
  }

  public static combine(results: Result<unknown, unknown>[]): Result<void, unknown> {
    for (const result of results) {
      if (result.isFailure) {
        return Result.fail(result.getError());
      }
    }
    return Result.ok();
  }
}
