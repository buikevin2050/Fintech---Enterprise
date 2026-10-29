import { Result } from '../../common/domain/result.js';
import { ILedgerRepository } from './ports/ledger-repository.port.js';
import { GetAccountBalanceInput, GetAccountBalanceOutput } from './dtos/get-balance.dto.js';
import { AccountNotFoundError } from '../domain/exceptions/ledger.exceptions.js';

export class GetAccountBalanceUseCase {
  constructor(private readonly ledgerRepository: ILedgerRepository) {}

  public async execute(input: GetAccountBalanceInput): Promise<Result<GetAccountBalanceOutput, Error>> {
    try {
      const account = await this.ledgerRepository.findAccountById(input.accountId, false);
      if (!account) {
        return Result.fail(new AccountNotFoundError(input.accountId));
      }

      const output: GetAccountBalanceOutput = {
        accountId: account.id,
        code: account.code,
        name: account.name,
        type: account.type,
        currency: account.currency.code,
        balanceMinorUnits: account.balance.amount.toString(),
        balanceFormatted: account.balance.toDecimalString(),
        status: account.status,
        version: account.version,
        updatedAt: account.updatedAt.toISOString(),
      };

      return Result.ok(output);
    } catch (err) {
      return Result.fail(err as Error);
    }
  }
}
