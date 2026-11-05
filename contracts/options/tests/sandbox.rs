//! End-to-end against byte-identical mainnet contracts (`intents.near` v0.4.5, `wrap.near`),
//! deployed into a local sandbox next to this contract (tests/common). Every value asserted below
//! is read back from chain state.

mod common;

use common::*;
use near_api::NearToken;
use near_sdk::serde_json::json;

const POSITION_IN_INTENTS: &str = "nep245:options.sandbox:1";

#[tokio::test]
async fn call_lifecycle_through_mainnet_intents() -> testresult::TestResult<()> {
    let env = setup().await;
    env.fund_wnear("alice.sandbox", 10 * WNEAR_ONE).await;
    env.fund_tusdc("bob.sandbox", 20 * TUSDC_ONE).await;
    let expiry = now_ns() + 180 * SECOND_NS;

    // 1. Alice writes 3 calls (1 wNEAR each, strike 2 tUSDC) by moving 3.5 wNEAR inside Intents.
    env.ok_via_intents(
        "alice.sandbox",
        WNEAR,
        35 * WNEAR_ONE / 10,
        create_msg("call", WNEAR_ONE, 2 * TUSDC_ONE, expiry),
    )
    .await;
    assert_eq!(env.longs("alice.sandbox", "1").await, 3);
    assert_eq!(
        env.intents_balance("alice.sandbox", WNEAR).await,
        7 * WNEAR_ONE,
        "0.5 refunded"
    );
    assert_eq!(
        env.intents_balance(OPTIONS, WNEAR).await,
        3 * WNEAR_ONE,
        "collateral sits in Intents"
    );

    // 2. Alice lists 2 longs at 0.1 tUSDC each. 3. Bob buys both, overpaying by 0.05.
    env.ok(
        "alice.sandbox",
        OPTIONS,
        "list",
        json!({"series_id": "1", "amount": "2", "price_per_option": (TUSDC_ONE / 10).to_string()}),
        YOCTO,
    )
    .await;
    env.ok_via_intents(
        "bob.sandbox",
        TUSDC,
        TUSDC_ONE / 4,
        json!({"action": "buy", "offer_id": "1", "amount": "2"}),
    )
    .await;
    assert_eq!(env.longs("bob.sandbox", "1").await, 2);
    assert_eq!(
        env.intents_balance("alice.sandbox", TUSDC).await,
        TUSDC_ONE / 5,
        "premium paid inside Intents"
    );
    assert_eq!(
        env.intents_balance("bob.sandbox", TUSDC).await,
        20 * TUSDC_ONE - TUSDC_ONE / 5,
        "overpayment refunded"
    );

    // 4. Bob deposits one long into Intents and 5. hands it to Carol there, with 2 tUSDC for the strike.
    env.ok(
        "bob.sandbox",
        OPTIONS,
        "mt_transfer_call",
        json!({"receiver_id": INTENTS, "token_id": "1", "amount": "1", "approval": null, "memo": null, "msg": ""}),
        YOCTO,
    )
    .await;
    assert_eq!(
        env.intents_balance("bob.sandbox", POSITION_IN_INTENTS)
            .await,
        1,
        "position is an Intents asset"
    );
    env.ok(
        "bob.sandbox",
        INTENTS,
        "mt_transfer",
        json!({"receiver_id": "carol.sandbox", "token_id": POSITION_IN_INTENTS, "amount": "1", "approval": null, "memo": null}),
        YOCTO,
    )
    .await;
    env.ok(
        "bob.sandbox",
        INTENTS,
        "mt_transfer",
        json!({"receiver_id": "carol.sandbox", "token_id": TUSDC, "amount": (2 * TUSDC_ONE).to_string(), "approval": null, "memo": null}),
        YOCTO,
    )
    .await;
    assert_eq!(
        env.intents_balance("carol.sandbox", POSITION_IN_INTENTS)
            .await,
        1
    );

    // 6. Carol withdraws the long from Intents and 7. exercises it: pays 2 tUSDC, receives 1 wNEAR.
    env.ok(
        "carol.sandbox",
        INTENTS,
        "mt_withdraw",
        json!({"token": OPTIONS, "receiver_id": "carol.sandbox", "token_ids": ["1"], "amounts": ["1"]}),
        YOCTO,
    )
    .await;
    assert_eq!(env.longs("carol.sandbox", "1").await, 1);
    env.ok_via_intents(
        "carol.sandbox",
        TUSDC,
        2 * TUSDC_ONE,
        json!({"action": "exercise", "series_id": "1", "amount": "1"}),
    )
    .await;
    assert_eq!(env.longs("carol.sandbox", "1").await, 0);
    assert_eq!(
        env.intents_balance("carol.sandbox", WNEAR).await,
        WNEAR_ONE,
        "delivered inside Intents"
    );
    let series = env.series(1).await;
    assert_eq!(field(&series, "long_supply"), 2);
    assert_eq!(field(&series, "collateral_held"), 2 * WNEAR_ONE);
    assert_eq!(field(&series, "proceeds_held"), 2 * TUSDC_ONE);

    // 8. Refusal: Bob exercises more longs than he holds. Our receipt fails; Intents refunds.
    let bob_tusdc = env.intents_balance("bob.sandbox", TUSDC).await;
    env.refused_via_intents(
        "bob.sandbox",
        TUSDC,
        4 * TUSDC_ONE,
        json!({"action": "exercise", "series_id": "1", "amount": "2"}),
        "ERR_INSUFFICIENT_LONGS",
    )
    .await;
    assert_eq!(
        env.intents_balance("bob.sandbox", TUSDC).await,
        bob_tusdc,
        "refused exercise fully refunded"
    );

    // 9. Alice takes the strike payment; 10. her collateral stays locked before expiry.
    env.ok(
        "alice.sandbox",
        OPTIONS,
        "withdraw_proceeds",
        json!({"series_id": "1"}),
        YOCTO,
    )
    .await;
    assert_eq!(
        env.intents_balance("alice.sandbox", TUSDC).await,
        TUSDC_ONE / 5 + 2 * TUSDC_ONE
    );
    let early = env
        .call(
            "alice.sandbox",
            OPTIONS,
            "reclaim_collateral",
            json!({"series_id": "1"}),
            YOCTO,
        )
        .await;
    assert!(format!("{:?}", early.failures()).contains("ERR_NOT_EXPIRED"));

    // 11. Time passes. Expired longs can't be exercised; the writer reclaims the rest.
    env.wait_until_expired(1).await;
    env.refused_via_intents(
        "bob.sandbox",
        TUSDC,
        2 * TUSDC_ONE,
        json!({"action": "exercise", "series_id": "1", "amount": "1"}),
        "ERR_EXPIRED",
    )
    .await;
    assert_eq!(
        env.intents_balance("bob.sandbox", TUSDC).await,
        bob_tusdc,
        "late exercise fully refunded"
    );
    env.ok(
        "alice.sandbox",
        OPTIONS,
        "reclaim_collateral",
        json!({"series_id": "1"}),
        YOCTO,
    )
    .await;
    assert_eq!(
        env.intents_balance("alice.sandbox", WNEAR).await,
        9 * WNEAR_ONE,
        "2 unexercised wNEAR back"
    );

    // 12. Everything settled: the contract holds nothing inside Intents.
    assert_eq!(env.intents_balance(OPTIONS, WNEAR).await, 0);
    assert_eq!(env.intents_balance(OPTIONS, TUSDC).await, 0);

    // 13. Carol leaves Intents with her delivered wNEAR as a plain token balance.
    env.register("carol.sandbox", "wrap.sandbox").await;
    env.ok(
        "carol.sandbox",
        INTENTS,
        "ft_withdraw",
        json!({"token": "wrap.sandbox", "receiver_id": "carol.sandbox", "amount": WNEAR_ONE.to_string()}),
        YOCTO,
    )
    .await;
    let carol_wnear: String = env
        .view(
            "wrap.sandbox",
            "ft_balance_of",
            json!({"account_id": "carol.sandbox"}),
        )
        .await;
    assert_eq!(carol_wnear, WNEAR_ONE.to_string());
    Ok(())
}

#[tokio::test]
async fn writer_closes_and_cancels_through_mainnet_intents() -> testresult::TestResult<()> {
    let env = setup().await;
    env.fund_wnear("alice.sandbox", 10 * WNEAR_ONE).await;
    let expiry = now_ns() + 600 * SECOND_NS;
    env.ok_via_intents(
        "alice.sandbox",
        WNEAR,
        2 * WNEAR_ONE,
        create_msg("call", WNEAR_ONE, 2 * TUSDC_ONE, expiry),
    )
    .await;

    // List one, cancel, then close both: all collateral returns inside Intents before expiry.
    env.ok(
        "alice.sandbox",
        OPTIONS,
        "list",
        json!({"series_id": "1", "amount": "1", "price_per_option": "5"}),
        YOCTO,
    )
    .await;
    assert_eq!(env.longs(OPTIONS, "1").await, 1, "escrowed");
    let stranger = env
        .call(
            "bob.sandbox",
            OPTIONS,
            "cancel_offer",
            json!({"offer_id": "1"}),
            YOCTO,
        )
        .await;
    assert!(format!("{:?}", stranger.failures()).contains("ERR_NOT_SELLER"));
    env.ok(
        "alice.sandbox",
        OPTIONS,
        "cancel_offer",
        json!({"offer_id": "1"}),
        YOCTO,
    )
    .await;
    env.ok(
        "alice.sandbox",
        OPTIONS,
        "close",
        json!({"series_id": "1", "amount": "2"}),
        YOCTO,
    )
    .await;
    assert_eq!(
        env.intents_balance("alice.sandbox", WNEAR).await,
        10 * WNEAR_ONE
    );
    assert_eq!(env.intents_balance(OPTIONS, WNEAR).await, 0);
    assert_eq!(field(&env.series(1).await, "long_supply"), 0);

    // Not through Intents: a direct `mt_on_transfer` call is refused.
    let forged = env
        .call(
            "bob.sandbox",
            OPTIONS,
            "mt_on_transfer",
            json!({
                "sender_id": "bob.sandbox", "previous_owner_ids": ["bob.sandbox"],
                "token_ids": [WNEAR], "amounts": [WNEAR_ONE.to_string()],
                "msg": json!({"action": "write", "series_id": "1"}).to_string()
            }),
            NearToken::from_yoctonear(0),
        )
        .await;
    assert!(format!("{:?}", forged.failures()).contains("ERR_NOT_INTENTS"));
    Ok(())
}
