//! Local devnet for the web app: the same sandbox as tests/sandbox.rs (byte-identical mainnet
//! Intents + wNEAR, tUSDC test token, this contract), seeded with real transactions into every
//! state the UI must render. Writes `web/.env.development.local` (RPC, contracts, and the sandbox's
//! public genesis key so the board can sign as any devnet account), then serves until killed.
//!
//!   cargo test --test devnet -- --ignored --nocapture            # seeded
//!   DEVNET_EMPTY=1 cargo test --test devnet -- --ignored --nocapture   # no series (empty state)

mod common;

use common::evm::EvmWallet;
use common::*;
use near_api::types::transaction::result::ExecutionFinalResult;
use near_sdk::serde_json::json;

#[tokio::test]
#[ignore = "long-running local devnet for the web app"]
async fn devnet() -> testresult::TestResult<()> {
    // The sandbox keeps 5 epochs of 60 blocks, about two minutes of history; the board reads the
    // refusals band's transactions back by hash for as long as the devnet runs, so keep them all.
    let env = setup_with(near_sandbox::config::SandboxConfig {
        additional_config: Some(json!({ "gc_num_epochs_to_keep": 100_000 })),
        ..Default::default()
    })
    .await;
    let refusals = if std::env::var("DEVNET_EMPTY").is_err() {
        seed(&env).await
    } else {
        Vec::new()
    };

    let env_file = concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/../../web/.env.development.local"
    );
    std::fs::write(
        env_file,
        format!(
            "VITE_NETWORK=sandbox\nVITE_RPC_URL={}\nVITE_OPTIONS_CONTRACT={OPTIONS}\nVITE_INTENTS_CONTRACT={INTENTS}\nVITE_WRAP_CONTRACT=wrap.sandbox\n\
             # The refusals band's transactions, read back from chain by hash (web/src/lib/refusals.ts).\n\
             VITE_REFUSAL_TXS={}\n\
             # Seeded accounts to act as (holders, and the funded 0x wallet the devnet test wallet signs for), offered by the board's account choosers.\n\
             VITE_DEVNET_ACCOUNTS=alice.sandbox,bob.sandbox,carol.sandbox,{}\n\
             # The sandbox's public genesis key, shared by every devnet account (web/src/lib/devnetSigner.ts, D-017).\n\
             VITE_SANDBOX_SIGNER_KEY={}\n\
             # The relayer's devnet account and key (web/relay/relay.ts, D-030). No VITE_ prefix: the dev server reads them, the bundle never does.\n\
             RELAY_ACCOUNT_ID=relayer.sandbox\n\
             RELAY_SECRET_KEY={}\n",
            env.sandbox.rpc_addr,
            refusals.join(","),
            EvmWallet::new(0x42).address,
            near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY,
            near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY
        ),
    )?;
    println!("DEVNET READY rpc={} env={env_file}", env.sandbox.rpc_addr);
    loop {
        tokio::time::sleep(std::time::Duration::from_secs(3600)).await;
    }
}

/// Every state the board must render, produced by real transactions. Returns the refusals band's
/// three refused transactions as `id:signer:hash`.
async fn seed(env: &Env) -> Vec<String> {
    env.fund_wnear("alice.sandbox", 9_000 * WNEAR_ONE).await;
    env.fund_wnear("carol.sandbox", 10 * WNEAR_ONE).await;
    env.fund_tusdc("bob.sandbox", 500 * TUSDC_ONE).await;
    env.fund_tusdc("carol.sandbox", 200 * TUSDC_ONE).await;
    // A wallet with no NEAR account (D-030): balances inside Intents under its 0x address, as a
    // 1Click deposit from another chain would land. Its key is the tests' deterministic EVM key.
    let evm = EvmWallet::new(0x42);
    for (from, token, amount) in [
        ("alice.sandbox", WNEAR, 20 * WNEAR_ONE),
        ("bob.sandbox", TUSDC, 50 * TUSDC_ONE),
    ] {
        env.ok(
            from,
            INTENTS,
            "mt_transfer",
            json!({"receiver_id": evm.address, "token_id": token, "amount": amount.to_string(), "approval": null, "memo": null}),
            YOCTO,
        )
        .await;
    }
    let now = now_ns();
    let day = 24 * 3_600 * SECOND_NS;

    // 1. A traded call: 12 written, 5 offered, 3 sold, 1 exercised, 1 moved into Intents.
    env.ok_via_intents(
        "alice.sandbox",
        WNEAR,
        12 * WNEAR_ONE,
        create_msg("call", WNEAR_ONE, 4_800_000, now + 7 * day),
    )
    .await;
    env.ok(
        "alice.sandbox",
        OPTIONS,
        "list",
        json!({"series_id": "1", "amount": "5", "price_per_option": "420000"}),
        YOCTO,
    )
    .await;
    env.ok_via_intents(
        "bob.sandbox",
        TUSDC,
        3 * 420_000,
        json!({"action": "buy", "offer_id": "1", "amount": "3"}),
    )
    .await;
    env.ok_via_intents(
        "bob.sandbox",
        TUSDC,
        4_800_000,
        json!({"action": "exercise", "series_id": "1", "amount": "1"}),
    )
    .await;
    env.ok("bob.sandbox", OPTIONS, "mt_transfer_call", json!({"receiver_id": INTENTS, "token_id": "1", "amount": "1", "approval": null, "memo": null, "msg": ""}), YOCTO).await;

    // 2. A fresh put, fully offered: 4 written against 16.8 tUSDC.
    env.ok_via_intents(
        "carol.sandbox",
        TUSDC,
        16_800_000,
        create_msg("put", WNEAR_ONE, 4_200_000, now + 2 * day),
    )
    .await;
    env.ok(
        "carol.sandbox",
        OPTIONS,
        "list",
        json!({"series_id": "2", "amount": "4", "price_per_option": "350000"}),
        YOCTO,
    )
    .await;

    // 3. Large figures: 2,500 calls of 2.5 wNEAR, strike 12.345678 tUSDC, 90 days out.
    env.ok_via_intents(
        "alice.sandbox",
        WNEAR,
        6_250 * WNEAR_ONE,
        create_msg("call", 5 * WNEAR_ONE / 2, 12_345_678, now + 90 * day),
    )
    .await;

    // 4. Short-dated call that gets exercised once, expires, and is reclaimed.
    env.ok_via_intents(
        "alice.sandbox",
        WNEAR,
        3 * WNEAR_ONE,
        create_msg("call", WNEAR_ONE, 4_500_000, now + 150 * SECOND_NS),
    )
    .await;
    env.ok(
        "alice.sandbox",
        OPTIONS,
        "list",
        json!({"series_id": "4", "amount": "2", "price_per_option": "100000"}),
        YOCTO,
    )
    .await;
    env.ok_via_intents(
        "bob.sandbox",
        TUSDC,
        100_000,
        json!({"action": "buy", "offer_id": "3", "amount": "1"}),
    )
    .await;
    env.ok_via_intents(
        "bob.sandbox",
        TUSDC,
        4_500_000,
        json!({"action": "exercise", "series_id": "4", "amount": "1"}),
    )
    .await;

    // 5. Short-dated call nobody exercises: expires, collateral released but not yet reclaimed.
    env.ok_via_intents(
        "carol.sandbox",
        WNEAR,
        2 * WNEAR_ONE,
        create_msg("call", WNEAR_ONE, 5_000_000, now + 160 * SECOND_NS),
    )
    .await;

    env.wait_until_expired(4).await;
    env.wait_until_expired(5).await;
    env.ok(
        "alice.sandbox",
        OPTIONS,
        "reclaim_collateral",
        json!({"series_id": "4"}),
        YOCTO,
    )
    .await;

    // 6. The refusals band (web/src/components/Refusals.tsx): three moves the contract refuses,
    //    sent for real so the board can read each one back from chain by its hash.
    let carol = "carol.sandbox";
    vec![
        refused(
            "reclaim-early",
            carol,
            env.call(
                carol,
                OPTIONS,
                "reclaim_collateral",
                json!({"series_id": "2"}),
                YOCTO,
            )
            .await,
            "ERR_NOT_EXPIRED",
        ),
        refused(
            "exercise-expired",
            carol,
            env.via_intents(
                carol,
                TUSDC,
                5_000_000,
                json!({"action": "exercise", "series_id": "5", "amount": "1"}),
            )
            .await,
            "ERR_EXPIRED",
        ),
        refused(
            "exercise-unheld",
            carol,
            env.via_intents(
                carol,
                TUSDC,
                4_800_000,
                json!({"action": "exercise", "series_id": "1", "amount": "1"}),
            )
            .await,
            "ERR_INSUFFICIENT_LONGS",
        ),
    ]
}

/// `id:signer:hash` for a transaction this contract refused with `expected`.
fn refused(id: &str, signer: &str, result: ExecutionFinalResult, expected: &str) -> String {
    let failures = format!("{:?}", result.receipt_failures());
    assert!(
        failures.contains(expected),
        "{id}: expected {expected}, got: {failures}"
    );
    format!("{id}:{signer}:{}", result.outcomes()[0].transaction_hash)
}
