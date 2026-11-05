/**
 * The contract's refusals in plain words (contracts/options/src/types.rs), shown beside the code
 * the chain returned, so a refusal says why and not only what.
 */
const CAUSE: Record<string, string> = {
  ERR_NOT_EXPIRED: "The collateral is locked until expiry. Not even the writer can take it back early.",
  ERR_EXPIRED: "Exercise ends at expiry. After it, the unexercised collateral is the writer's to reclaim.",
  ERR_INSUFFICIENT_LONGS: "Only a holder can do this, and only with as many options as they hold.",
  ERR_NOT_WRITER: "Only this series' writer can do this.",
  ERR_NOT_SELLER: "Only the account that listed this offer can cancel it.",
  ERR_ALREADY_RECLAIMED: "The writer has already reclaimed this series' collateral.",
  ERR_NOTHING_TO_PAY: "No strike payments are waiting on this series.",
  ERR_UNKNOWN_OFFER: "That offer is gone: sold out or cancelled.",
  ERR_OFFER_AMOUNT: "The offer has fewer options left than that.",
  ERR_INSUFFICIENT_PAYMENT: "The payment sent was less than the price.",
  ERR_WRONG_TOKEN: "That token doesn't pay for this action.",
  ERR_BAD_EXPIRY: "Expiry must be between 1 minute and 366 days away.",
  ERR_BELOW_MIN: "The amount is below the contract's minimum for that token.",
  ERR_SAME_TOKEN: "Underlying and quote must be different tokens.",
  ERR_TOKEN_NOT_ALLOWED: "The contract doesn't accept that token.",
  ERR_ZERO: "The amount must cover at least one option.",
};

export function causeOf(err: string): string | null {
  return CAUSE[err] ?? null;
}
