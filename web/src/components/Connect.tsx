import { WalletIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { useState } from "react";

import { connectEvm, disconnectEvm, type EvmWallet, useEvmWallets } from "../lib/evm";
import { connect, disconnect } from "../lib/wallet";

/**
 * Who connects, and how (D-030): a NEAR wallet through near-connect, or any EVM wallet this
 * browser announces (EIP-6963). An EVM wallet needs no NEAR account: it signs a message and
 * Warrant's relayer pays the gas. One connection at a time, so a reload restores the right one.
 */
export function ConnectOptions({ onViewer, onDone, surface }: { onViewer: (account: string | null) => void; onDone?: () => void; surface: "menu" | "sheet" }) {
  const wallets = useEvmWallets();
  const [busy, setBusy] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const run = async (key: string, open: () => Promise<string | null>) => {
    setBusy(key);
    setProblem(null);
    try {
      const account = await open();
      if (account) {
        onViewer(account);
        onDone?.();
      }
    } catch (error) {
      setProblem(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(null);
    }
  };
  const near = () =>
    run("near", async () => {
      disconnectEvm();
      return connect();
    });
  const evm = (wallet: EvmWallet) =>
    run(wallet.info.rdns, async () => {
      await disconnect().catch(() => {});
      return connectEvm(wallet, onViewer);
    });

  // In the header's menu the rows are list items on a card; in a sheet they are keys in its well.
  const row = clsx(
    "grid min-h-12 w-full grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-3 rounded-xl px-3 py-2 text-left transition-colors duration-150 disabled:opacity-50",
    surface === "menu" ? "hover:bg-bed" : "bg-card shadow-[var(--shadow-key)] hover:text-lock",
  );
  const sub = "text-iron-2";

  return (
    <div className="flex flex-col gap-1.5">
      <button type="button" className={row} disabled={busy !== null} onClick={() => void near()}>
        <WalletIcon size={20} weight="duotone" aria-hidden="true" />
        <span className="flex min-w-0 flex-col">
          <span className="text-ui font-semibold">{busy === "near" ? "Connecting…" : "NEAR wallet"}</span>
          <span className={clsx("text-label", sub)}>Signs NEAR transactions</span>
        </span>
      </button>
      {wallets.map((wallet) => (
        <button key={wallet.info.rdns} type="button" className={row} disabled={busy !== null} onClick={() => void evm(wallet)}>
          <img src={wallet.info.icon} alt="" width={20} height={20} className="h-5 w-5 rounded-md" />
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-ui font-semibold">{busy === wallet.info.rdns ? "Connecting…" : wallet.info.name}</span>
            <span className={clsx("text-label", sub)}>EVM wallet · no NEAR account needed</span>
          </span>
        </button>
      ))}
      {wallets.length === 0 && <p className={clsx("px-3 py-1 text-label", sub)}>No EVM wallet in this browser. MetaMask, Rabby or any EIP-6963 wallet appears here.</p>}
      {problem && (
        <p className="px-3 text-label text-refuse" role="alert">
          {problem}
        </p>
      )}
      <p className={clsx("px-3 pt-1 text-label", surface === "menu" ? "max-w-[40ch]" : "max-w-[64ch]", sub)}>
        An EVM wallet signs a message for NEAR Intents. Warrant's relayer sends it and pays the gas; it can't change what you signed.
      </p>
    </div>
  );
}
