export class LedgerPresenter {
    static toSuccess(data) {
        return {
            success: true,
            data,
            timestamp: new Date().toISOString(),
        };
    }
    static toError(code, message, details) {
        return {
            success: false,
            error: {
                code,
                message,
                ...(details !== undefined ? { details } : {}),
            },
            timestamp: new Date().toISOString(),
        };
    }
}
//# sourceMappingURL=ledger.presenter.js.map