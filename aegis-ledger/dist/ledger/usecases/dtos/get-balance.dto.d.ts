export interface GetAccountBalanceInput {
    accountId: string;
}
export interface GetAccountBalanceOutput {
    accountId: string;
    code: string;
    name: string;
    type: string;
    currency: string;
    balanceMinorUnits: string;
    balanceFormatted: string;
    status: string;
    version: number;
    updatedAt: string;
}
//# sourceMappingURL=get-balance.dto.d.ts.map