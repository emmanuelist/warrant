import { CheckIcon, CopyIcon } from "@phosphor-icons/react";
import clsx from "clsx";
import { type ReactNode, useEffect, useState } from "react";

import { base64ToBytes } from "../lib/base58";
import type { Board } from "../lib/chain";
import { config, explorer } from "../lib/config";
import { EVM_CHAIN_IDS, isEvmAccount, personalSign, sendFromWallet } from "../lib/evm";
import { account as short, parse } from "../lib/format";
import {
  FINAL_STATUSES,
  generateIntent,
  type Quote,
  quote,
  type RemoteToken,
  remoteTokens,
  status,
  type StatusResponse,
  submitDeposit,
  submitIntent,
  type TransferStatus,
  type UnsignedIntent,
} from "../lib/oneclick";
import { view } from "../lib/rpc";
import { markStep, remember, type Transfer, useTransfer } from "../lib/transfers";
import { onIntents, send, signIntent } from "../lib/wallet";
import { AmountField, Field, inputClass, Submit } from "./form";
import { Label, Out } from "./parts";
import { MessageReview } from "./Review";

const CHAINS: Record<string, string> = {
  eth: "Ethereum",
  base: "Base",
  arb: "Arbitrum",
  op: "Optimism",
  pol: "Polygon",
  bsc: "BNB Chain",
  avax: "Avalanche",
  gnosis: "Gnosis",
  sol: "Solana",
  btc: "Bitcoin",
  ton: "TON",
  tron: "TRON",
  sui: "Sui",
  aptos: "Aptos",
  xrp: "XRP Ledger",
  doge: "Dogecoin",
  zec: "Zcash",
  stellar: "Stellar",
  bera: "Berachain",
  cardano: "Cardano",
};

export const chainName = (code: string) => CHAINS[code] ?? code.toUpperCase();

/** 1Click's status answers with `explorerUrl: ""` (E-032), so transaction links are built here, by chain name. */
const EXPLORERS: Record<string, string> = {
  Ethereum: "https://etherscan.io/tx/",
  Base: "https://basescan.org/tx/",
  Arbitrum: "https://arbiscan.io/tx/",
  Optimism: "https://optimistic.etherscan.io/tx/",
  Polygon: "https://polygonscan.com/tx/",
  "BNB Chain": "https://bscscan.com/tx/",
  Avalanche: "https://snowscan.xyz/tx/",
  Gnosis: "https://gnosisscan.io/tx/",
  Solana: "https://solscan.io/tx/",
  Bitcoin: "https://mempool.space/tx/",
  TON: "https://tonviewer.com/transaction/",
  TRON: "https://tronscan.org/#/transaction/",
};
const NEAR_CHAIN = "NEAR";

function hopUrl(hop: { hash: string; explorerUrl: string }, chain: string): string | null {
  if (hop.explorerUrl) return hop.explorerUrl;
  if (chain === NEAR_CHAIN) return explorer?.tx(hop.hash) ?? null;
  return EXPLORERS[chain] ? `${EXPLORERS[chain]}${hop.hash}` : null;
}

/** Assets offered as the other end of a route: the same symbol first, then the majors. */
const MAJORS = ["USDC", "USDT", "ETH", "BTC", "SOL"];

function routable(tokens: RemoteToken[], symbol: string | undefined): RemoteToken[] {
  const rank = (t: RemoteToken) => (t.symbol === symbol ? -1 : MAJORS.indexOf(t.symbol));
  return tokens
    .filter((t) => t.blockchain !== "near" && (t.symbol === symbol || MAJORS.includes(t.symbol)))
    .sort((a, b) => rank(a) - rank(b) || chainName(a.blockchain).localeCompare(chainName(b.blockchain)));
}

/** The route a form opens on: the asset's own on Base, else USDC on Base, where most wallets hold it. */
function preferred(tokens: RemoteToken[], symbol: string | undefined): RemoteToken | undefined {
  return tokens.find((t) => t.symbol === symbol && t.blockchain === "base") ?? tokens.find((t) => t.symbol === "USDC" && t.blockchain === "base") ?? tokens[0];
}

/** An EVM wallet's own address is the natural refund or recipient on any chain it can act on. */
const ownAddress = (viewer: string | null, token: RemoteToken | undefined) => (viewer && isEvmAccount(viewer) && token && EVM_CHAIN_IDS[token.blockchain] ? viewer : "");

function useRemoteTokens() {
  const [state, setState] = useState<{ tokens: RemoteToken[] | null; error: string | null }>({ tokens: null, error: null });
  useEffect(() => {
    let live = true;
    remoteTokens().then(
      (tokens) => live && setState({ tokens, error: null }),
      (error: unknown) => live && setState({ tokens: null, error: error instanceof Error ? error.message : String(error) }),
    );
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/** Cross-chain routes exist only between real chains: honest on the devnet, not simulated. */
export function MainnetOnly() {
  return (
    <div className="border-y border-rule py-4 text-ui text-iron-2">
      <p>
        Cross-chain routes are mainnet-only. 1Click moves real assets between real chains and NEAR Intents on mainnet; this
        devnet's tokens exist only here.
      </p>
      <p className="mt-2">On mainnet this tab quotes the route live, shows the deposit address, and tracks it until it lands.</p>
    </div>
  );
}

function Problem({ message }: { message: string }) {
  return (
    <p className="text-ui text-refuse" role="alert">
      {message}
    </p>
  );
}

const assetLabel = (t: RemoteToken) => `${t.symbol} · ${chainName(t.blockchain)}`;
const message = (error: unknown) => (error instanceof Error ? error.message : String(error));
const clock = (iso: string) => `${iso.slice(11, 19)} UTC`;

/** Another chain → the viewer's Intents balance: quote, deposit address, live status. */
export function CrossChainIn({ board, viewer, tokenId }: { board: Board; viewer: string | null; tokenId: string }) {
  const { tokens, error } = useRemoteTokens();
  const destination = board.tokens[tokenId];
  const sources = tokens ? routable(tokens, destination?.symbol) : [];
  const [sourceId, setSourceId] = useState("");
  const source = sources.find((t) => t.assetId === sourceId) ?? preferred(sources, destination?.symbol);
  const [text, setText] = useState("");
  const [typedRefund, setRefund] = useState<string | null>(null);
  const refund = typedRefund ?? ownAddress(viewer, source);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [quoted, setQuoted] = useState<{ quote: Quote; source: RemoteToken } | null>(null);
  const amount = source ? parse(text, source.decimals) : null;
  const valid = amount !== null && amount > 0n && refund.trim().length > 0 && viewer !== null;

  if (error) return <Problem message={`1Click didn't answer: ${error}`} />;
  if (!tokens) return <p className="text-iron-2">Reading 1Click routes…</p>;
  if (quoted?.quote.depositAddress) {
    return <DepositAddress quote={quoted.quote} source={quoted.source} destination={destination?.symbol ?? tokenId} viewer={viewer} />;
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        if (!valid || !source || !viewer || amount === null) return;
        setBusy(true);
        setProblem(null);
        try {
          const result = await quote({
            dry: false,
            originAsset: source.assetId,
            depositType: "ORIGIN_CHAIN",
            destinationAsset: tokenId,
            amount: amount.toString(),
            refundTo: refund.trim(),
            refundType: "ORIGIN_CHAIN",
            recipient: viewer,
            recipientType: "INTENTS",
          });
          if (!result.depositAddress) throw new Error("1Click returned no deposit address.");
          remember({
            depositAddress: result.depositAddress,
            account: viewer,
            direction: "in",
            chain: chainName(source.blockchain),
            from: `${result.amountInFormatted} ${assetLabel(source)}`,
            to: `≈ ${result.amountOutFormatted} ${destination?.symbol ?? ""} · NEAR Intents`,
            validUntil: result.validUntil,
            timeEstimate: result.timeEstimate,
          });
          setQuoted({ quote: result, source });
        } catch (error) {
          setProblem(message(error));
        } finally {
          setBusy(false);
        }
      }}
    >
      <Field label="Send from">
        <select className={inputClass} value={source?.assetId ?? ""} onChange={(e) => setSourceId(e.target.value)}>
          {sources.map((t) => (
            <option key={t.assetId} value={t.assetId}>
              {assetLabel(t)}
            </option>
          ))}
        </select>
      </Field>
      <AmountField label="Amount" unit={source?.symbol ?? "units"} value={text} onChange={setText} balance={null} token={undefined} invalid={text !== "" && !amount} />
      <Field label={`Refund address on ${source ? chainName(source.blockchain) : "that chain"}`} hint="If the route fails, 1Click refunds here, on the chain you sent from.">
        <input className={inputClass} value={refund} onChange={(e) => setRefund(e.target.value.trim())} placeholder="0x…" autoComplete="off" spellCheck={false} />
      </Field>
      <p className="text-ui text-iron-2">
        Lands as {destination?.symbol ?? tokenId} in <span className="fig text-iron">{viewer ? short(viewer) : "your account"}</span>'s
        Intents balance. Quoted live by 1Click without a partner key; its fee is already in the amount you receive.
      </p>
      {problem && <Problem message={problem} />}
      <Submit blocked={viewer ? (valid ? null : "Choose an amount and a refund address.") : "Connect a wallet first: the deposit is credited to it."} busy={busy}>
        Get a deposit address
      </Submit>
    </form>
  );
}

function DepositAddress({ quote: q, source, destination, viewer }: { quote: Quote; source: RemoteToken; destination: string; viewer: string | null }) {
  const address = q.depositAddress ?? "";
  const [copied, setCopied] = useState(false);
  const [txHash, setTxHash] = useState("");
  const [notified, setNotified] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const canPay = viewer !== null && isEvmAccount(viewer) && EVM_CHAIN_IDS[source.blockchain] !== undefined;
  const pay = async () => {
    if (!viewer) return;
    setPaying(true);
    setNotified(null);
    try {
      const hash = await sendFromWallet(viewer, source.blockchain, source.contractAddress, address, BigInt(q.amountIn));
      setTxHash(hash);
      await submitDeposit(address, hash);
      setNotified("Sent. 1Click has the transaction.");
    } catch (error) {
      setNotified(message(error));
    } finally {
      setPaying(false);
    }
  };
  return (
    <div className="flex flex-col gap-4">
      <div className="border-y border-rule py-4">
        <Label>
          Send exactly {q.amountInFormatted} {source.symbol} on {chainName(source.blockchain)} to
        </Label>
        <p className="fig mt-2 break-all text-body text-iron">{address}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {canPay && (
            <button
              type="button"
              disabled={paying || txHash !== ""}
              data-tone="iron"
              className="enamel plate-label h-9 rounded-full px-3.5 text-meta transition-[opacity,translate] duration-150 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => void pay()}
            >
              {paying ? "Check your wallet…" : `Send from your wallet`}
            </button>
          )}
          <button
            type="button"
            className="plate-label inline-flex h-9 items-center gap-2 rounded-full px-3.5 text-meta shadow-[inset_0_0_0_1.5px_var(--color-iron)] hover:bg-bed"
            onClick={() => {
              void navigator.clipboard.writeText(address).then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1800);
              });
            }}
          >
            {copied ? <CheckIcon weight="bold" size="1.1em" className="text-live" aria-hidden="true" /> : <CopyIcon weight="bold" size="1.1em" aria-hidden="true" />}
            <span aria-live="polite">{copied ? "Copied" : "Copy address"}</span>
          </button>
        </div>
        <p className="mt-3 text-meta text-iron-2">
          Send it with a plain transfer from your wallet before <span className="fig text-iron">{q.validUntil.slice(11, 16)} UTC</span>. 1Click
          doesn't guarantee transfers that arrive through a bridge, and less than the quoted amount is reported as incomplete.
        </p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-ui">
        <div>
          <dt className="plate-label text-label text-iron-2">You receive</dt>
          <dd className="fig mt-1">
            ≈ {q.amountOutFormatted} {destination}
          </dd>
        </div>
        <div>
          <dt className="plate-label text-label text-iron-2">After it's seen</dt>
          <dd className="fig mt-1">~{q.timeEstimate} s</dd>
        </div>
      </dl>
      <Tracker depositAddress={address} />
      <form
        className="flex items-end gap-2"
        onSubmit={async (event) => {
          event.preventDefault();
          try {
            await submitDeposit(address, txHash.trim());
            setNotified("1Click has the transaction.");
          } catch (error) {
            setNotified(message(error));
          }
        }}
      >
        <Field label="Optional: your deposit's tx hash" className="flex-1">
          <input className={inputClass} value={txHash} onChange={(e) => setTxHash(e.target.value)} placeholder="0x…" spellCheck={false} />
        </Field>
        <button type="submit" disabled={!txHash.trim()} className="plate-label h-11 rounded-full px-3.5 text-meta shadow-[inset_0_0_0_1.5px_var(--color-iron)] disabled:opacity-40">
          Notify
        </button>
      </form>
      {notified && <p className="text-meta text-iron-2">{notified}</p>}
      <p className="text-meta text-iron-2">Tracking continues on your account page if you close this.</p>
    </div>
  );
}

type Prepared = { quote: Quote; destination: RemoteToken; intent: UnsignedIntent };

/**
 * The viewer's Intents balance → another chain. The quote comes with the exact NEP-413 message
 * (generated by 1Click), shown before signing; the wallet signs that message, not a transaction.
 */
export function CrossChainOut({ board, viewer, tokenId, onSettled }: { board: Board; viewer: string | null; tokenId: string; onSettled: () => void }) {
  const { tokens, error } = useRemoteTokens();
  const origin = board.tokens[tokenId];
  const destinations = tokens ? routable(tokens, origin?.symbol) : [];
  const [destinationId, setDestinationId] = useState("");
  const destination = destinations.find((t) => t.assetId === destinationId) ?? preferred(destinations, origin?.symbol);
  const balance = board.viewer?.inIntents[tokenId] ?? null;
  const [text, setText] = useState("");
  const [typedRecipient, setRecipient] = useState<string | null>(null);
  const recipient = typedRecipient ?? ownAddress(viewer, destination);
  const [step, setStep] = useState<"form" | "quoting" | "quoted" | "signing" | "tracking">("form");
  const [problem, setProblem] = useState<string | null>(null);
  const [prepared, setPrepared] = useState<Prepared | null>(null);
  const amount = origin?.decimals != null ? parse(text, origin.decimals) : null;
  const over = amount !== null && balance !== null && amount > balance;
  const valid = amount !== null && amount > 0n && !over && recipient.trim().length > 0 && viewer !== null;
  const edit = <T,>(set: (value: T) => void) => (value: T) => {
    set(value);
    setStep("form");
  };

  if (error) return <Problem message={`1Click didn't answer: ${error}`} />;
  if (!tokens) return <p className="text-iron-2">Reading 1Click routes…</p>;

  if (step === "tracking" && prepared?.quote.depositAddress) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-ui">
          Signed and submitted. {prepared.quote.amountInFormatted} {origin?.symbol} left your Intents balance for{" "}
          <span className="fig">{short(recipient)}</span> on {chainName(prepared.destination.blockchain)}.
        </p>
        <Tracker depositAddress={prepared.quote.depositAddress} onFinal={onSettled} />
      </div>
    );
  }

  const getQuote = async () => {
    if (!valid || !destination || !viewer || amount === null) return;
    setStep("quoting");
    setProblem(null);
    try {
      const result = await quote({
        dry: false,
        originAsset: tokenId,
        depositType: "INTENTS",
        destinationAsset: destination.assetId,
        amount: amount.toString(),
        refundTo: viewer,
        refundType: "INTENTS",
        recipient: recipient.trim(),
        recipientType: "DESTINATION_CHAIN",
      });
      if (!result.depositAddress) throw new Error("1Click returned no deposit address.");
      const intent = await generateIntent(result.depositAddress, viewer, isEvmAccount(viewer) ? "erc191" : "nep413");
      setPrepared({ quote: result, destination, intent });
      setStep("quoted");
    } catch (error) {
      setProblem(message(error));
      setStep("form");
    }
  };

  const signAndSend = async () => {
    const depositAddress = prepared?.quote.depositAddress;
    if (!viewer || !prepared || !depositAddress) return;
    setStep("signing");
    setProblem(null);
    try {
      const { intent } = prepared;
      if (intent.standard === "erc191") {
        // An EVM wallet's 0x account owns its key implicitly: no registration, 1Click relays it.
        const signature = await personalSign(viewer, intent.payload);
        // 1Click takes an ERC-191 intent without checking it, and a bad one shows "processing" for
        // good (docs/CONTEXT.md); Intents' free simulation checks the signature and balance first.
        await view(config.intentsContract, "simulate_intents", { signed: [{ standard: "erc191", payload: intent.payload, signature }] });
        await submitIntent(intent, null, signature);
      } else {
        const signed = await signIntent(viewer, intent.payload.message, base64ToBytes(intent.payload.nonce));
        // Intents verifies NEP-413 signatures against keys it knows for the account; a named account's
        // wallet key has to be registered once (implicit accounts' own key always is).
        const known = await view<boolean>(config.intentsContract, "has_public_key", { account_id: viewer, public_key: signed.publicKey });
        if (!known) {
          const added = await send(viewer, onIntents("add_public_key", { public_key: signed.publicKey }));
          if (added.refusal) throw new Error(`Registering your key with Intents failed: ${added.refusal}`);
        }
        await submitIntent(intent, signed.publicKey, signed.signature);
      }
      remember({
        depositAddress,
        account: viewer,
        direction: "out",
        chain: chainName(prepared.destination.blockchain),
        from: `${prepared.quote.amountInFormatted} ${origin?.symbol ?? ""} · NEAR Intents`,
        to: `≈ ${prepared.quote.amountOutFormatted} ${assetLabel(prepared.destination)}`,
        validUntil: prepared.quote.validUntil,
        timeEstimate: prepared.quote.timeEstimate,
      });
      setStep("tracking");
    } catch (error) {
      const text = message(error);
      // A lapsed quote can't be signed: start over with a fresh one.
      const expired = /expired/i.test(text);
      setProblem(expired ? "The quote expired before it was signed. Get a new one." : text);
      setStep(expired ? "form" : "quoted");
    }
  };

  const ready = prepared && step !== "form" && step !== "quoting";

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        void (step === "quoted" ? signAndSend() : getQuote());
      }}
    >
      <Field label="Receive as">
        <select className={inputClass} value={destination?.assetId ?? ""} onChange={(e) => edit(setDestinationId)(e.target.value)}>
          {destinations.map((t) => (
            <option key={t.assetId} value={t.assetId}>
              {assetLabel(t)}
            </option>
          ))}
        </select>
      </Field>
      <AmountField
        label="Amount"
        unit={origin?.symbol ?? "units"}
        value={text}
        onChange={edit(setText)}
        balance={balance}
        token={origin}
        invalid={text !== "" && (!amount || over)}
        balanceLabel="inside Intents"
      />
      <Field label={`Recipient on ${destination ? chainName(destination.blockchain) : "that chain"}`}>
        <input
          className={inputClass}
          value={recipient}
          onChange={(e) => edit(setRecipient)(e.target.value.trim())}
          placeholder="0x…"
          autoComplete="off"
          spellCheck={false}
        />
      </Field>
      {ready ? (
        <dl className="grid grid-cols-2 gap-3 border-y border-rule py-3 text-ui">
          <div>
            <dt className="plate-label text-label text-iron-2">They receive</dt>
            <dd className="fig mt-1">
              ≈ {prepared.quote.amountOutFormatted} {prepared.destination.symbol}
            </dd>
          </div>
          <div>
            <dt className="plate-label text-label text-iron-2">Arrives in</dt>
            <dd className="fig mt-1">~{prepared.quote.timeEstimate} s</dd>
          </div>
          <p className="col-span-2 text-meta text-iron-2">
            Sign before <span className="fig text-iron">{prepared.quote.validUntil.slice(11, 16)} UTC</span>; after that the quote lapses.
          </p>
        </dl>
      ) : (
        <p className="text-ui text-iron-2">
          {over
            ? "More than you hold inside Intents."
            : "Quoted live by 1Click without a partner key; its fee is already in the amount received. If the route fails, it refunds to your Intents balance."}
        </p>
      )}
      {problem && <Problem message={problem} />}
      <Submit
        blocked={viewer ? (valid ? null : "Choose an amount and a recipient.") : "Connect a wallet first."}
        busy={step === "quoting" || step === "signing"}
        review={ready && <MessageReview intent={prepared.intent} tokens={board.tokens} destination={chainName(prepared.destination.blockchain)} />}
      >
        {step === "quoted" ? "Sign and send" : "Get a quote"}
      </Submit>
    </form>
  );
}

type Step = { id: "start" | "seen" | "routing" | "done"; title: string; at?: string; note?: ReactNode; state: "done" | "current" | "todo" | "failed" };

/** Wise-style steps (DESIGN.md "References"): plain names, the time each was first seen, and where money went on failure. */
function stepsFor(transfer: Transfer | undefined, state: StatusResponse | null): Step[] {
  const s = state?.status;
  const out = transfer?.direction === "out";
  const chain = transfer?.chain ?? "the other chain";
  const reached = (statuses: TransferStatus[]) => (s ? statuses.includes(s) : false);
  const seen = reached(["KNOWN_DEPOSIT_TX", "PROCESSING", "SUCCESS", "REFUNDED", "FAILED"]);
  const routing = reached(["PROCESSING", "SUCCESS", "REFUNDED", "FAILED"]);
  const hops = (list: { hash: string; explorerUrl: string }[] | undefined, on: string) =>
    list && list.length > 0 ? (
      <span className="flex flex-wrap gap-x-3">
        {list.map((hop) => {
          const url = hopUrl(hop, on);
          return url ? (
            <a key={hop.hash} className="fig underline decoration-rule underline-offset-4 hover:decoration-iron" href={url} target="_blank" rel="noreferrer">
              {hop.hash.slice(0, 10)}…
              <Out />
            </a>
          ) : (
            <span key={hop.hash} className="fig">
              {hop.hash.slice(0, 10)}…
            </span>
          );
        })}
      </span>
    ) : null;

  const start: Step = {
    id: "start",
    title: out ? "Signed and submitted" : "Quote locked",
    at: transfer ? new Date(transfer.createdAt).toISOString() : undefined,
    note: transfer ? `${transfer.from} → ${transfer.to}` : undefined,
    state: "done",
  };
  const waiting = s === "PENDING_DEPOSIT" || s === undefined;
  const incomplete = s === "INCOMPLETE_DEPOSIT";
  const seenStep: Step = {
    id: "seen",
    title: incomplete
      ? "Deposit below the quoted amount"
      : seen
        ? out
          ? "Transfer seen by 1Click"
          : `Deposit seen on ${chain}`
        : out
          ? "Waiting for 1Click to see the transfer"
          : `Waiting for your deposit on ${chain}`,
    at: transfer?.steps.KNOWN_DEPOSIT_TX ?? transfer?.steps.INCOMPLETE_DEPOSIT,
    note: incomplete
      ? "1Click won't route it as quoted. Search the deposit account on the Intents explorer."
      : waiting && transfer
        ? out
          ? "1Click usually picks it up within seconds."
          : `Send before ${transfer.validUntil.slice(11, 16)} UTC.`
        : hops(state?.swapDetails.originChainTxHashes, out ? NEAR_CHAIN : chain),
    state: incomplete ? "failed" : seen ? "done" : "current",
  };
  const finished = s === "SUCCESS" || s === "REFUNDED" || s === "FAILED";
  const routingStep: Step = {
    id: "routing",
    title: finished ? "Routed" : "Routing",
    at: transfer?.steps.PROCESSING,
    note: s === "KNOWN_DEPOSIT_TX" || s === "PROCESSING" ? `usually ~${transfer?.timeEstimate ?? "a few"} s` : undefined,
    state: finished ? "done" : routing || s === "KNOWN_DEPOSIT_TX" ? "current" : "todo",
  };
  const doneStep: Step =
    s === "REFUNDED"
      ? {
          id: "done",
          title: "Refunded",
          at: transfer?.steps.REFUNDED,
          note: `${state?.swapDetails.refundedAmountFormatted ?? ""} returned to ${out ? "your Intents balance" : `your refund address on ${chain}`}${
            state?.swapDetails.refundReason ? ` · ${state.swapDetails.refundReason}` : ""
          }`,
          state: "failed",
        }
      : s === "FAILED"
        ? { id: "done", title: "Failed", at: transfer?.steps.FAILED, note: "1Click reports an error. Search the deposit account on the Intents explorer.", state: "failed" }
        : {
            id: "done",
            title: out ? `Delivered on ${chain}` : "In your Intents balance",
            at: transfer?.steps.SUCCESS,
            note: s === "SUCCESS" ? (
              <span className="flex flex-wrap gap-x-3">
                {state?.swapDetails.amountOutFormatted && <span className="fig">{state.swapDetails.amountOutFormatted} received</span>}
                {hops(state?.swapDetails.destinationChainTxHashes, out ? chain : NEAR_CHAIN)}
              </span>
            ) : undefined,
            state: s === "SUCCESS" ? "done" : "todo",
          };
  return [start, seenStep, routingStep, doneStep];
}

const MARK: Record<Step["state"], string> = {
  done: "bg-iron",
  current: "bg-board shadow-[inset_0_0_0_2px_var(--color-iron)]",
  todo: "bg-board shadow-[inset_0_0_0_1px_var(--color-rule)]",
  failed: "bg-refuse",
};

/** Live 1Click status for one deposit address: a step timeline, or one summary line that opens it. */
export function Tracker({ depositAddress, onFinal, compact = false }: { depositAddress: string; onFinal?: () => void; compact?: boolean }) {
  const transfer = useTransfer(depositAddress);
  const [state, setState] = useState<StatusResponse | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer = 0;
    const tick = async () => {
      try {
        const next = await status(depositAddress);
        if (stopped) return;
        setState(next);
        setProblem(null);
        markStep(depositAddress, next.status, next.updatedAt);
        if (FINAL_STATUSES.includes(next.status)) {
          onFinal?.();
          return;
        }
      } catch (error) {
        if (!stopped) setProblem(message(error));
      }
      if (!stopped) timer = window.setTimeout(tick, 5_000);
    };
    void tick();
    return () => {
      stopped = true;
      window.clearTimeout(timer);
    };
    // onFinal is a notification; re-subscribing on every parent render would refetch for nothing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [depositAddress]);

  const steps = stepsFor(transfer, state);
  const current = steps.find((step) => step.state === "failed") ?? steps.find((step) => step.state === "current") ?? steps.at(-1);
  const timeline = (
    <ol className="flex flex-col">
      {steps.map((step, index) => (
        <li key={step.id} className="relative grid grid-cols-[1.25rem_minmax(0,1fr)_auto] gap-x-2 pb-3 last:pb-0">
          {index < steps.length - 1 && (
            <span className={clsx("absolute left-[0.35rem] top-3.5 bottom-0 w-[2px]", step.state === "done" ? "bg-iron" : "bg-rule")} aria-hidden="true" />
          )}
          <span className={clsx("relative mt-1 h-2.5 w-2.5 rounded-full", MARK[step.state])} aria-hidden="true" />
          <div className="min-w-0">
            <p className={clsx("text-ui", step.state === "todo" ? "text-iron-2" : step.state === "failed" ? "text-refuse" : "text-iron")}>{step.title}</p>
            {step.note && <div className="mt-0.5 text-meta text-iron-2">{step.note}</div>}
          </div>
          <span className="fig pt-0.5 text-label text-iron-2">{step.at ? clock(step.at) : ""}</span>
        </li>
      ))}
    </ol>
  );

  return (
    <div className={clsx("flex flex-col gap-2", !compact && "border-b border-rule pb-4")} role="status" aria-live="polite" aria-label={current ? `Transfer: ${current.title}` : "Transfer status"}>
      {compact ? (
        <details>
          <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-2 text-meta">
            <span className={clsx("h-2.5 w-2.5 rounded-full", current ? MARK[current.state] : MARK.todo)} aria-hidden="true" />
            <span className={current?.state === "failed" ? "text-refuse" : undefined}>{state ? current?.title : "Reading status…"}</span>
            {current?.at && <span className="fig text-label text-iron-2">since {clock(current.at)}</span>}
            <span className="plate-label text-micro text-iron-2 underline decoration-rule underline-offset-4">Steps</span>
          </summary>
          <div className="mt-3">{timeline}</div>
        </details>
      ) : (
        timeline
      )}
      {problem && <p className="text-meta text-refuse">{problem}</p>}
      {!compact && (
        <p className="fig text-label text-iron-2">
          1Click deposit account {short(depositAddress)} · search it on the{" "}
          <a className="underline decoration-rule underline-offset-4 hover:decoration-iron" href="https://explorer.near-intents.org" target="_blank" rel="noreferrer">
            Intents explorer
            <Out />
          </a>
        </p>
      )}
    </div>
  );
}
