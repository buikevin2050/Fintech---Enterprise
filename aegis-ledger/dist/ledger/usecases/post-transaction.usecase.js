import { randomUUID, createHash } from 'crypto';
import { Result } from '../../common/domain/result.js';
import { Currency } from '../domain/value-objects/currency.vo.js';
import { Money } from '../domain/value-objects/money.vo.js';
import { Entry } from '../domain/entities/entry.entity.js';
import { Transaction } from '../domain/entities/transaction.entity.js';
import { AccountNotFoundError, AccountFrozenError, DuplicateTransactionError } from '../domain/exceptions/ledger.exceptions.js';
export class PostTransactionUseCase {
    unitOfWork;
    idempotencyStore;
    constructor(unitOfWork, idempotencyStore) {
        this.unitOfWork = unitOfWork;
        this.idempotencyStore = idempotencyStore;
    }
    async execute(input) {
        const requestHash = createHash('sha256')
            .update(JSON.stringify(input))
            .digest('hex');
        // 1. Idempotency Check & Lock Acquisition
        const acquireResult = await this.idempotencyStore.acquire(input.idempotencyKey, requestHash);
        if (acquireResult === 'EXISTS') {
            const existing = await this.idempotencyStore.get(input.idempotencyKey);
            if (existing) {
                if (existing.status === 'COMPLETED' && existing.responsePayload) {
                    return Result.ok(existing.responsePayload);
                }
                if (existing.status === 'PROCESSING') {
                    return Result.fail(new Error(`Concurrent request in progress for idempotency key: ${input.idempotencyKey}`));
                }
            }
            return Result.fail(new DuplicateTransactionError(input.idempotencyKey));
        }
        try {
            const txId = randomUUID();
            // 2. Build Domain Entries & Verify Amounts
            const entries = [];
            for (let i = 0; i < input.entries.length; i++) {
                const rawEntry = input.entries[i];
                const currencyRes = Currency.create(rawEntry.currency);
                if (currencyRes.isFailure) {
                    await this.idempotencyStore.fail(input.idempotencyKey, currencyRes.getError().message);
                    return Result.fail(currencyRes.getError());
                }
                const moneyRes = Money.create(rawEntry.amount, currencyRes.getValue());
                if (moneyRes.isFailure) {
                    await this.idempotencyStore.fail(input.idempotencyKey, moneyRes.getError().message);
                    return Result.fail(moneyRes.getError());
                }
                const entryRes = Entry.create({
                    transactionId: txId,
                    accountId: rawEntry.accountId,
                    direction: rawEntry.direction,
                    amount: moneyRes.getValue(),
                    sequence: i,
                    description: rawEntry.description,
                }, randomUUID());
                if (entryRes.isFailure) {
                    await this.idempotencyStore.fail(input.idempotencyKey, entryRes.getError().message);
                    return Result.fail(entryRes.getError());
                }
                entries.push(entryRes.getValue());
            }
            // 3. Construct Transaction Aggregate & Invariants Check (Sum of Debits == Sum of Credits)
            const txResult = Transaction.create({
                idempotencyKey: input.idempotencyKey,
                description: input.description,
                entries,
                type: 'STANDARD',
                status: 'DRAFT',
            }, txId);
            if (txResult.isFailure) {
                await this.idempotencyStore.fail(input.idempotencyKey, txResult.getError().message);
                return Result.fail(txResult.getError());
            }
            const transaction = txResult.getValue();
            // 4. Atomic Execution inside Unit of Work with Canonical Lock Ordering
            const output = await this.unitOfWork.execute(async ({ ledgerRepo }) => {
                // Collect distinct account IDs and sort them to PREVENT DEADLOCKS
                const uniqueAccountIds = Array.from(new Set(entries.map((e) => e.accountId))).sort();
                // Pessimistic Locking: SELECT ... FOR UPDATE ordered by account ID
                const lockedAccounts = await ledgerRepo.findAccountsByIds(uniqueAccountIds, true);
                const accountMap = new Map(lockedAccounts.map((acc) => [acc.id, acc]));
                // Validate existence and status of every referenced account
                for (const accountId of uniqueAccountIds) {
                    const acc = accountMap.get(accountId);
                    if (!acc) {
                        throw new AccountNotFoundError(accountId);
                    }
                    if (acc.status !== 'ACTIVE') {
                        throw new AccountFrozenError(accountId);
                    }
                }
                // Apply ledger entries sequentially to update balances & check constraints
                for (const entry of transaction.entries) {
                    const acc = accountMap.get(entry.accountId);
                    const applyRes = acc.applyEntry(entry);
                    if (applyRes.isFailure) {
                        throw applyRes.getError();
                    }
                }
                // Post transaction (seals transaction)
                const postRes = transaction.post();
                if (postRes.isFailure) {
                    throw postRes.getError();
                }
                // Persist: Append-Only Transaction & Entries + Update Account Balances
                await ledgerRepo.saveTransaction(transaction);
                for (const acc of accountMap.values()) {
                    await ledgerRepo.updateAccountBalance(acc);
                }
                const formattedEntries = transaction.entries.map((e) => ({
                    id: e.id,
                    accountId: e.accountId,
                    direction: e.direction,
                    amount: e.amount.amount.toString(),
                    currency: e.amount.currency.code,
                    sequence: e.sequence,
                    description: e.description,
                }));
                const finalOutput = {
                    transactionId: transaction.id,
                    idempotencyKey: transaction.idempotencyKey,
                    status: 'POSTED',
                    type: transaction.type,
                    description: transaction.description,
                    postedAt: transaction.postedAt.toISOString(),
                    entries: formattedEntries,
                };
                return finalOutput;
            });
            // 5. Complete Idempotency record with immutable output
            await this.idempotencyStore.complete(input.idempotencyKey, output, transaction.id);
            return Result.ok(output);
        }
        catch (error) {
            await this.idempotencyStore.fail(input.idempotencyKey, error.message);
            return Result.fail(error);
        }
    }
}
//# sourceMappingURL=post-transaction.usecase.js.map