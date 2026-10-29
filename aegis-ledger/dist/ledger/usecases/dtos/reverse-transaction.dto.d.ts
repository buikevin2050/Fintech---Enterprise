export interface ReverseTransactionInput {
    transactionId: string;
    reversalIdempotencyKey: string;
    reason: string;
}
export interface ReverseTransactionOutput {
    reversalTransactionId: string;
    originalTransactionId: string;
    idempotencyKey: string;
    status: 'POSTED';
    type: 'REVERSAL';
    description: string;
    postedAt: string;
}
//# sourceMappingURL=reverse-transaction.dto.d.ts.map