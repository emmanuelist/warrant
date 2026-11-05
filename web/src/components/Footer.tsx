import { config, explorer } from "../lib/config";
import { Mark } from "./Mark";
import { Out, Wrap } from "./parts";

/** Where the claim can be checked, and its limits stated plainly. */
export function Footer() {
  return (
    <footer className="foot night mt-auto bg-iron text-board">
      <Wrap className="grid gap-10 py-12 text-ui md:grid-cols-[1fr_auto]">
        <div className="flex items-start gap-3">
          <Mark className="mt-0.5 h-8 w-7 shrink-0 text-board" />
          <div>
            <p className="display text-[1.2rem] leading-none tracking-[0.16em] [font-variation-settings:'wdth'_125,'wght'_680]">WARRANT</p>
            <p className="mt-3 max-w-[48ch] text-panel-ink-2">
              Options that can't default and need no oracle: the collateral is locked inside NEAR Intents until expiry.
            </p>
          </div>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="plate-label text-label text-panel-ink-3">Contract</dt>
          <dd className="fig break-all">
            {explorer ? (
              <a className="underline decoration-panel-line underline-offset-4 hover:decoration-board" href={explorer.account(config.optionsContract)} target="_blank" rel="noreferrer">
                {config.optionsContract}
              </a>
            ) : (
              config.optionsContract
            )}
          </dd>
          <dt className="plate-label text-label text-panel-ink-3">Settles in</dt>
          <dd className="fig">{config.intentsContract}</dd>
          {config.repoUrl && (
            <>
              <dt className="plate-label text-label text-panel-ink-3">Source</dt>
              <dd>
                <a className="underline decoration-panel-line underline-offset-4 hover:decoration-board" href={config.repoUrl} target="_blank" rel="noreferrer">
                  {config.repoUrl.replace(/^https?:\/\//, "")}
                  <Out />
                </a>
              </dd>
            </>
          )}
          <dt className="plate-label text-label text-panel-ink-3">Limits</dt>
          <dd className="text-panel-ink-2">Unaudited. Demo amounts only. Physical settlement: no price oracle.</dd>
        </dl>
      </Wrap>
    </footer>
  );
}
