#!/usr/bin/env bash
# The first mainnet deploy (#10, D-035). Keys stay in ~/.near-credentials and are never printed.
#
#   scripts/mainnet-deploy.sh accounts     holder and relayer key files; no funds move
#   scripts/mainnet-deploy.sh contract     creates warrant-options.near if needed, deploys, inits
#   scripts/mainnet-deploy.sh holder       funds the holder's gas
#   scripts/mainnet-deploy.sh relayer      funds the relayer and adds its one-method key
#   scripts/mainnet-deploy.sh host         gives the linked Vercel project that key
#   scripts/mainnet-deploy.sh lock         deletes every key on the contract account: cannot be undone (#18)
#
# `contract` deploys what `cargo near build reproducible-wasm` built from a clean commit, so
# NEP-330 metadata names that commit and a rebuild reproduces the on-chain code hash.
set -euo pipefail
cd "$(dirname "$0")/.."

OWNER=d0482bffd77daa246ff50cd36cd8c8392548a0cf0fc7d6ccd887a3675f084148
OWNER_KEY="$HOME/.near-credentials/implicit/$OWNER.json"
CONTRACT=warrant-options.near
WASM=contracts/options/target/near/options.wasm
RPC=https://free.rpc.fastnear.com
HOLDER_DIR="$HOME/.near-credentials/warrant-holder"
RELAYER_DIR="$HOME/.near-credentials/warrant-relayer"
# 3.27 NEAR of code stake + 0.23 spare for state, about 23 KB. `retire` returns all of it (D-038).
CONTRACT_NEAR='3.5 NEAR'
HOLDER_NEAR='0.1 NEAR'
RELAYER_NEAR='0.2 NEAR'
RELAYER_ALLOWANCE='0.15 NEAR'
# 2026-11-26 00:00 UTC, the day the demo series expire: the earliest `retire` can run (D-038).
RETIRE_AFTER_NS=1795651200000000000

exists() {
  curl -s --max-time 20 "$RPC" -H 'content-type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"query\",\"params\":{\"request_type\":\"view_account\",\"finality\":\"final\",\"account_id\":\"$1\"}}" |
    grep -q '"amount"'
}

only_file() { find "$1" -maxdepth 1 -name '*.json' 2>/dev/null | head -1; }

new_key_file() {
  [ -n "$(only_file "$1")" ] && return
  mkdir -p "$1"
  chmod 700 "$1"
  near account create-account fund-later use-auto-generation save-to-folder "$1" >/dev/null 2>&1
  chmod 600 "$(only_file "$1")"
}

case "${1:-}" in
accounts)
  new_key_file "$HOLDER_DIR"
  new_key_file "$RELAYER_DIR"
  echo "holder  $(basename "$(only_file "$HOLDER_DIR")" .json)"
  echo "relayer $(basename "$(only_file "$RELAYER_DIR")" .json)"
  ;;

contract)
  [ -f "$WASM" ] || { echo "No $WASM: run cargo near build reproducible-wasm in contracts/options." >&2; exit 1; }
  grep -aq 'source_code_snapshot' "$WASM" || { echo "$WASM has no NEP-330 snapshot: build it with reproducible-wasm." >&2; exit 1; }
  if ! exists "$CONTRACT"; then
    near account create-account fund-myself "$CONTRACT" "$CONTRACT_NEAR" autogenerate-new-keypair save-to-legacy-keychain \
      sign-as "$OWNER" network-config mainnet sign-with-access-key-file "$OWNER_KEY" send
  fi
  near contract deploy "$CONTRACT" use-file "$WASM" with-init-call new \
    json-args "{\"owner_id\":\"$OWNER\",\"intents_id\":\"intents.near\",\"retire_after_ns\":\"$RETIRE_AFTER_NS\"}" \
    prepaid-gas '100 Tgas' attached-deposit '0 NEAR' network-config mainnet sign-with-legacy-keychain send
  ;;

holder)
  id="$(basename "$(only_file "$HOLDER_DIR")" .json)"
  [ -n "$id" ] || { echo "Run: scripts/mainnet-deploy.sh accounts" >&2; exit 1; }
  near tokens "$OWNER" send-near "$id" "$HOLDER_NEAR" network-config mainnet sign-with-access-key-file "$OWNER_KEY" send
  ;;

relayer)
  file="$(only_file "$RELAYER_DIR")"
  id="$(basename "$file" .json)"
  [ -n "$id" ] || { echo "Run: scripts/mainnet-deploy.sh accounts" >&2; exit 1; }
  near tokens "$OWNER" send-near "$id" "$RELAYER_NEAR" network-config mainnet sign-with-access-key-file "$OWNER_KEY" send
  # The key the host gets can call one method on one contract, and spends at most the allowance.
  near account add-key "$id" grant-function-call-access --allowance "$RELAYER_ALLOWANCE" \
    --contract-account-id intents.near --function-names execute_intents \
    autogenerate-new-keypair save-to-legacy-keychain network-config mainnet sign-with-access-key-file "$file" send
  near account list-keys "$id" network-config mainnet now
  ;;

host)
  # After `vercel link` in web/ (the host is the user's call). The key travels over stdin, never argv.
  id="$(basename "$(only_file "$RELAYER_DIR")" .json)"
  key_file="$(find "$HOME/.near-credentials/mainnet/$id" -name '*.json' 2>/dev/null | head -1)"
  [ -n "$key_file" ] || { echo "Run: scripts/mainnet-deploy.sh relayer" >&2; exit 1; }
  printf '%s' "$id" | (cd web && vercel env add RELAY_ACCOUNT_ID production --no-sensitive)
  python3 -c 'import json,sys; sys.stdout.write(json.load(open(sys.argv[1]))["private_key"])' "$key_file" |
    (cd web && vercel env add RELAY_SECRET_KEY production --sensitive)
  ;;

lock)
  # After this, nobody can change the code. Only the contract's own `retire` returns the deposit.
  [ "${LOCK_IT:-}" = "yes" ] || { echo "This cannot be undone. Run the last redeploy first, then: LOCK_IT=yes $0 lock" >&2; exit 1; }
  keys="$(curl -s --max-time 20 "$RPC" -H 'content-type: application/json' \
    -d "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"query\",\"params\":{\"request_type\":\"view_access_key_list\",\"finality\":\"final\",\"account_id\":\"$CONTRACT\"}}" |
    python3 -c 'import json,sys; print(" ".join(k["public_key"] for k in json.load(sys.stdin)["result"]["keys"]))')"
  for key in $keys; do
    near account delete-keys "$CONTRACT" public-keys "$key" network-config mainnet sign-with-legacy-keychain send
  done
  near account list-keys "$CONTRACT" network-config mainnet now
  ;;

*)
  sed -n 2,13p "$0" >&2
  exit 2
  ;;
esac
