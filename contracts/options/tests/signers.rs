//! A wallet from another chain runs a writer's whole lifecycle with no NEAR account (D-030):
//! it signs `erc191` intents, another account relays them, and every value asserted is read
//! back from chain state. Byte-identical mainnet `intents.near` and `wrap.near` (tests/common).

mod common;

use common::evm::{EvmWallet, auth_call, to_options};
use common::*;
use near_sdk::serde_json::json;

const POSITION_IN_INTENTS: &str = "nep245:options.sandbox:1";

#[tokio::test]
async fn wallet_without_near_account_runs_a_writers_lifecycle() -> testresult::TestResult<()> {
    let env = setup().await;
    let evm = EvmWallet::new(0x42);
    let wallet = evm.address.as_str();
    assert!(
        near_api::Account(id(wallet))
            .view()
            .fetch_from(&env.net)
            .await
            .is_err(),
        "the 0x address has no NEAR account"
    );

    // Funds land in the wallet's Intents account as a 1Click deposit would.
    env.fund_wnear("alice.sandbox", 10 * WNEAR_ONE).await;
    env.fund_tusdc("bob.sandbox", 20 * TUSDC_ONE).await;
    env.ok(
        "alice.sandbox",
        INTENTS,
        "mt_transfer",
        json!({"receiver_id": wallet, "token_id": WNEAR, "amount": (4 * WNEAR_ONE).to_string(), "approval": null, "memo": null}),
        YOCTO,
    )
    .await;

    // 1. Write 3 calls (1 wNEAR each, strike 2 tUSDC): a signed transfer with the create msg.
    let expiry = now_ns() + 120 * SECOND_NS;
    env.ok_relay(
        &evm,
        to_options(
            WNEAR,
            3 * WNEAR_ONE,
            create_msg("call", WNEAR_ONE, 2 * TUSDC_ONE, expiry),
        ),
        "create",
    )
    .await;
    assert_eq!(env.series(1).await["writer"], wallet);
    assert_eq!(env.longs(wallet, "1").await, 3);

    // 2. List 2 at 0.1 tUSDC through on_auth. 3. Bob, a NEAR account, buys one.
    env.ok_relay(
        &evm,
        auth_call(json!({"action": "list", "series_id": "1", "amount": "2", "price_per_option": (TUSDC_ONE / 10).to_string()})),
        "list",
    )
    .await;
    assert_eq!(env.longs(OPTIONS, "1").await, 2, "escrowed");
    env.ok_via_intents(
        "bob.sandbox",
        TUSDC,
        TUSDC_ONE / 10,
        json!({"action": "buy", "offer_id": "1", "amount": "1"}),
    )
    .await;
    assert_eq!(
        env.intents_balance(wallet, TUSDC).await,
        TUSDC_ONE / 10,
        "premium paid to the 0x account inside Intents"
    );

    // 4. Cancel the rest of the offer. 5. Move one long into Intents, where it is an asset the
    //    wallet can move with signed intents.
    env.ok_relay(
        &evm,
        auth_call(json!({"action": "cancel_offer", "offer_id": "1"})),
        "cancel",
    )
    .await;
    assert_eq!(env.longs(wallet, "1").await, 2);
    env.ok_relay(
        &evm,
        auth_call(json!({"action": "mt_transfer_call", "receiver_id": INTENTS, "token_id": "1", "amount": "1"})),
        "into intents",
    )
    .await;
    assert_eq!(env.intents_balance(wallet, POSITION_IN_INTENTS).await, 1);
    assert_eq!(env.longs(wallet, "1").await, 1);

    // 6. Bob exercises. 7. The wallet claims the strike through on_auth.
    env.ok_via_intents(
        "bob.sandbox",
        TUSDC,
        2 * TUSDC_ONE,
        json!({"action": "exercise", "series_id": "1", "amount": "1"}),
    )
    .await;
    env.ok_relay(
        &evm,
        auth_call(json!({"action": "withdraw_proceeds", "series_id": "1"})),
        "claim",
    )
    .await;
    assert_eq!(
        env.intents_balance(wallet, TUSDC).await,
        TUSDC_ONE / 10 + 2 * TUSDC_ONE
    );

    // 8. Refusals hold for a signer exactly as for a NEAR account. An early reclaim is refused
    //    and moves nothing.
    env.refused_relay(
        &evm,
        auth_call(json!({"action": "reclaim_collateral", "series_id": "1"})),
        "early reclaim",
        "ERR_NOT_EXPIRED",
    )
    .await;
    assert_eq!(
        field(&env.series(1).await, "collateral_held"),
        2 * WNEAR_ONE
    );
    //    Nobody can act for the wallet by calling on_auth themselves.
    let direct = env
        .call(
            "alice.sandbox",
            OPTIONS,
            "on_auth",
            json!({"signer_id": wallet, "msg": json!({"action": "reclaim_collateral", "series_id": "1"}).to_string()}),
            near_api::NearToken::from_yoctonear(0),
        )
        .await;
    assert!(
        format!("{:?}", direct.receipt_failures()).contains("ERR_NOT_INTENTS"),
        "on_auth from anyone but Intents is refused"
    );

    // 9. After expiry the wallet reclaims the unexercised collateral into its Intents account.
    env.wait_until_expired(1).await;
    env.ok_relay(
        &evm,
        auth_call(json!({"action": "reclaim_collateral", "series_id": "1"})),
        "reclaim",
    )
    .await;
    assert_eq!(env.intents_balance(wallet, WNEAR).await, 3 * WNEAR_ONE);
    let series = env.series(1).await;
    assert!(series["reclaimed"].as_bool().unwrap());
    assert_eq!(field(&series, "collateral_held"), 0);
    Ok(())
}
