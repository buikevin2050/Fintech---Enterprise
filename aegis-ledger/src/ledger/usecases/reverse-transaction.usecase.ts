import { randomUUID } from 'crypto';
import { Result } from '../../common/domain/result.js';
import { IUnitOfWork } from './ports/unit-of-work.port.js';
import { IIdempotencyStore } from './ports/idempotency-store.port.js';
import { ReverseTransactionInput, ReverseTransactionOutput } from './dtos/reverse-transaction.dto.js';
import { DuplicateTransactionError } from '../domain/exceptions/ledger.exceptions.js';

export class ReverseTransactionUseCase {
  constructor(
    private readonly unitOfWork: IUnitOfWork,
    private readonly idempotencyStore: IIdempotencyStore
  ) {}

  public async execute(input: ReverseTransactionInput): Promise<Result<ReverseTransactionOutput, Error>> {
    const acquireResult = await this.idempotencyStore.acquire(input.reversalIdempotencyKey, input.transactionId);
    if (acquireResult === 'EXISTS') {
      const existing = await this.idempotencyStore.get(input.reversalIdempotencyKey);
      if (existing && existing.status === 'COMPLETED' && existing.responsePayload) {
        return Result.ok(existing.responsePayload as ReverseTransactionOutput);
      }
      return Result.fail(new DuplicateTransactionError(input.reversalIdempotencyKey));
    }

    try {
      const output = await this.unitOfWork.execute(async ({ ledgerRepo }) => {
        const origTx = await ledgerRepo.findTransactionById(input.transactionId);
        if (!origTx) {
          throw new Error(`Original transaction not found: ${input.transactionId}`);
        }

        const reversalId = randomUUID();
        const reversalResult = origTx.createReversal(reversalId, input.reversalIdempotencyKey, input.reason);
        if (reversalResult.isFailure) {
          throw reversalResult.getError();
        }

        const reversalTx = reversalResult.getValue();

        // Lock accounts in canonical order
        const accountIds = Array.from(new Set(reversalTx.entries.map((e) => e.accountId))).sort();
        const accounts = await ledgerRepo.findAccountsByIds(accountIds, true);
        const accountMap = new Map(accounts.map((a) => [a.id, a]));

        // Apply reversal entries
        for (const entry of reversalTx.entries) {
          const acc = accountMap.get(entry.accountId);
          if (!acc) {
            throw new Error(`Account not found for reversal entry: ${entry.accountId}`);
          }
          const applyRes = acc.applyEntry(entry);
          if (applyRes.isFailure) {
            throw applyRes.getError();
          }
        }

        // Post reversal
        const postRes = reversalTx.post();
        if (postRes.isFailure) {
          throw postRes.getError();
        }

        // Save reversal transaction and updated account balances
        await ledgerRepo.saveTransaction(reversalTx);
        for (const acc of accountMap.values()) {
          await ledgerRepo.updateAccountBalance(acc);
        }

        const resultOutput: ReverseTransactionOutput = {
          reversalTransactionId: reversalTx.id,
          originalTransactionId: origTx.id,
          idempotencyKey: reversalTx.idempotencyKey,
          status: 'POSTED',
          type: 'REVERSAL',
          description: reversalTx.description,
          postedAt: reversalTx.postedAt!.toISOString(),
        };

        return resultOutput;
      });

      await this.idempotencyStore.complete(input.reversalIdempotencyKey, output, output.reversalTransactionId);
      return Result.ok(output);
    } catch (err) {
      await this.idempotencyStore.fail(input.reversalIdempotencyKey, (err as Error).message);
      return Result.fail(err as Error);
    }
  }
}
