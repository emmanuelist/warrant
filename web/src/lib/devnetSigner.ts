/**
 * Devnet only: signs transactions with the local sandbox's genesis key, which every devnet account
 * shares (tests/common/mod.rs). Wallets don't exist on a local chain, so this is how the devnet
 * board exercises every action for real (DECISIONS D-017). Never part of a mainnet path.
 */
import { config } from "./config";
import { type Outcome, signAndSend, type Transaction } from "./nearTx";

export type { FunctionCall, Outcome, Transaction } from "./nearTx";

/** Signs and sends each transaction in order, waiting for finality before the next. */
export async function sendDevnet(secret: string, signerId: string, transactions: Transaction[]): Promise<Outcome[]> {
  const outcomes: Outcome[] = [];
  for (const tx of transactions) outcomes.push(await signAndSend(config.rpcUrl, secret, signerId, tx));
  return outcomes;
}
