export interface PostTransactionEntryInput {
  accountId: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: string; // minor units as string (e.g. "10000" for $100.00) or decimal string with scale
  currency: string;
  description?: string | undefined;
}

export interface PostTransactionInput {
  idempotencyKey: string;
  description: string;
  entries: PostTransactionEntryInput[];
}

export interface TransactionEntryOutput {
  id: string;
  accountId: string;
  direction: 'DEBIT' | 'CREDIT';
  amount: string;
  currency: string;
  sequence: number;
  description?: string | undefined;
}

export interface PostTransactionOutput {
  transactionId: string;
  idempotencyKey: string;
  status: 'POSTED';
  type: 'STANDARD' | 'REVERSAL';
  description: string;
  postedAt: string;
  entries: TransactionEntryOutput[];
}
