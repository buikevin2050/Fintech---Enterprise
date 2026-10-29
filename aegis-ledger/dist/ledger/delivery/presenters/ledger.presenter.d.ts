export interface ApiSuccessResponse<T> {
    success: true;
    data: T;
    timestamp: string;
}
export interface ApiErrorResponse {
    success: false;
    error: {
        code: string;
        message: string;
        details?: unknown;
    };
    timestamp: string;
}
export declare class LedgerPresenter {
    static toSuccess<T>(data: T): ApiSuccessResponse<T>;
    static toError(code: string, message: string, details?: unknown): ApiErrorResponse;
}
//# sourceMappingURL=ledger.presenter.d.ts.map