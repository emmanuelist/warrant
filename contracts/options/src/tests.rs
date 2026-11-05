//! Unit tests: every action, every refusal in docs/SPEC.md, and the collateral invariant.
//! Cross-contract effects (payouts, Intents refunds) are covered by tests/sandbox.rs.

use defuse_nep245::MultiTokenCore;
use defuse_nep245::receiver::MultiTokenReceiver;
use defuse_nep245::resolver::MultiTokenResolver;
use near_sdk::json_types::{U64, U128};
use near_sdk::test_utils::{VMContextBuilder, get_logs};
use near_sdk::{
    AccountId, NearToken, PromiseOrValue, PromiseResult, RuntimeFeesConfig, testing_env,
};

use crate::*;

mod invariants;

const HOUR_NS: u64 = 3_600 * 1_000_000_000;
const NOW: u64 = 1_800_000_000 * 1_000_000_000;
const WNEAR: &str = "nep141:wrap.near";
const USDC: &str = "nep141:usdc.near";

fn acc(name: &str) -> AccountId {
    name.parse().unwrap()
}

fn owner() -> AccountId {
    acc("owner.near")
}
fn intents() -> AccountId {
    acc("intents.near")
}
fn options() -> AccountId {
    acc("options.near")
}
fn alice() -> AccountId {
    acc("alice.near")
}
fn bob() -> AccountId {
    acc("bob.near")
}

fn set_ctx(predecessor: &AccountId, deposit_yocto: u128, now: u64) {
    let mut builder = VMContextBuilder::new();
    builder
        .current_account_id(options())
        .signer_account_id(predecessor.clone())
        .predecessor_account_id(predecessor.clone())
        .attached_deposit(NearToken::from_yoctonear(deposit_yocto))
        .block_timestamp(now);
    testing_env!(builder.build());
}

fn set_ctx_with_result(predecessor: &AccountId, result: PromiseResult) {
    let mut builder = VMContextBuilder::new();
    builder
        .current_account_id(options())
        .predecessor_account_id(predecessor.clone())
        .block_timestamp(NOW);
    testing_env!(
        builder.build(),
        near_sdk::test_vm_config(),
        RuntimeFeesConfig::test(),
        Default::default(),
        vec![result],
    );
}

fn setup() -> Contract {
    set_ctx(&owner(), 0, NOW);
    let mut contract = Contract::new(owner(), intents());
    set_ctx(&owner(), 1, NOW);
    contract.allow_token(WNEAR.to_string(), U128(1));
    contract.allow_token(USDC.to_string(), U128(1));
    contract
}

/// Simulates `intents.mt_transfer_call(receiver = options)` from `sender`; returns the refund.
fn via_intents(
    contract: &mut Contract,
    sender: &AccountId,
    token: &str,
    amount: u128,
    msg: &str,
) -> u128 {
    set_ctx(&intents(), 0, NOW);
    via_intents_at(contract, sender, token, amount, msg)
}

fn via_intents_at(
    contract: &mut Contract,
    sender: &AccountId,
    token: &str,
    amount: u128,
    msg: &str,
) -> u128 {
    let result = contract.mt_on_transfer(
        sender.clone(),
        vec![sender.clone()],
        vec![token.to_string()],
        vec![U128(amount)],
        msg.to_string(),
    );
    match result {
        PromiseOrValue::Value(refunds) => refunds[0].0,
        PromiseOrValue::Promise(_) => panic!("expected a value"),
    }
}

/// Call: 10 wNEAR units per option, strike 50 USDC units per option, expires in one hour.
fn create_call_msg(expiry_ns: u64) -> String {
    format!(
        r#"{{"action":"create","kind":"call","underlying":"{WNEAR}","quote":"{USDC}","underlying_per_option":"10","strike_per_option":"50","expiry_ns":"{expiry_ns}"}}"#
    )
}

fn create_put_msg(expiry_ns: u64) -> String {
    format!(
        r#"{{"action":"create","kind":"put","underlying":"{WNEAR}","quote":"{USDC}","underlying_per_option":"10","strike_per_option":"50","expiry_ns":"{expiry_ns}"}}"#
    )
}

/// Alice writes 3 calls (35 wNEAR in, 5 refunded). Returns series 1.
fn with_call_series() -> Contract {
    let mut contract = setup();
    let refund = via_intents(
        &mut contract,
        &alice(),
        WNEAR,
        35,
        &create_call_msg(NOW + HOUR_NS),
    );
    assert_eq!(refund, 5);
    contract
}

fn series(contract: &Contract, id: u64) -> SeriesView {
    contract.get_series(U64(id)).expect("series exists")
}

fn longs(contract: &Contract, who: &AccountId, id: u64) -> u128 {
    contract.mt_balance_of(who.clone(), id.to_string()).0
}

fn assert_backed(contract: &Contract, id: u64) {
    let s = series(contract, id);
    if !s.reclaimed {
        assert_eq!(
            s.collateral_held.0,
            s.long_supply.0 * s.collateral_per_option.0
        );
    }
}

// ---------- create / write ----------

#[test]
fn create_call_mints_longs_and_refunds_remainder() {
    let contract = with_call_series();
    let s = series(&contract, 1);
    assert_eq!(s.writer, alice());
    assert_eq!(s.kind, OptionKind::Call);
    assert_eq!(s.collateral_token, WNEAR);
    assert_eq!(s.payment_token, USDC);
    assert_eq!(s.long_supply.0, 3);
    assert_eq!(s.collateral_held.0, 30);
    assert_eq!(longs(&contract, &alice(), 1), 3);
    assert_eq!(contract.mt_supply("1".to_string()), Some(U128(3)));
    assert_backed(&contract, 1);
}

#[test]
fn create_put_locks_quote() {
    let mut contract = setup();
    let refund = via_intents(
        &mut contract,
        &alice(),
        USDC,
        120,
        &create_put_msg(NOW + HOUR_NS),
    );
    assert_eq!(refund, 20);
    let s = series(&contract, 1);
    assert_eq!(s.collateral_token, USDC);
    assert_eq!(s.collateral_per_option.0, 50);
    assert_eq!(s.payment_token, WNEAR);
    assert_eq!(s.payment_per_option.0, 10);
    assert_eq!(s.long_supply.0, 2);
    assert_backed(&contract, 1);
}

#[test]
fn create_emits_events() {
    let _ = with_call_series();
    let logs = get_logs();
    assert!(logs.iter().any(
        |l| l.contains(r#""standard":"intents_options""#) && l.contains(r#""event":"create""#)
    ));
    assert!(
        logs.iter()
            .any(|l| l.contains(r#""standard":"nep245""#) && l.contains(r#""event":"mt_mint""#))
    );
}

#[test]
#[should_panic(expected = "ERR_NOT_INTENTS")]
fn create_refused_unless_called_by_intents() {
    let mut contract = setup();
    set_ctx(&alice(), 0, NOW);
    via_intents_at(
        &mut contract,
        &alice(),
        WNEAR,
        35,
        &create_call_msg(NOW + HOUR_NS),
    );
}

#[test]
#[should_panic(expected = "ERR_BATCH_NOT_SUPPORTED")]
fn batch_transfers_refused() {
    let mut contract = setup();
    set_ctx(&intents(), 0, NOW);
    let _ = contract.mt_on_transfer(
        alice(),
        vec![alice(), alice()],
        vec![WNEAR.to_string(), USDC.to_string()],
        vec![U128(10), U128(10)],
        create_call_msg(NOW + HOUR_NS),
    );
}

#[test]
#[should_panic(expected = "ERR_BAD_MSG")]
fn malformed_msg_refused() {
    let mut contract = setup();
    via_intents(&mut contract, &alice(), WNEAR, 35, r#"{"action":"steal"}"#);
}

#[test]
#[should_panic(expected = "ERR_WRONG_TOKEN")]
fn create_call_with_quote_collateral_refused() {
    let mut contract = setup();
    via_intents(
        &mut contract,
        &alice(),
        USDC,
        35,
        &create_call_msg(NOW + HOUR_NS),
    );
}

#[test]
#[should_panic(expected = "ERR_TOKEN_NOT_ALLOWED")]
fn create_with_unlisted_token_refused() {
    let mut contract = setup();
    set_ctx(&owner(), 1, NOW);
    contract.disallow_token(USDC.to_string());
    via_intents(
        &mut contract,
        &alice(),
        WNEAR,
        35,
        &create_call_msg(NOW + HOUR_NS),
    );
}

#[test]
#[should_panic(expected = "ERR_SAME_TOKEN")]
fn create_with_same_token_refused() {
    let mut contract = setup();
    let msg = format!(
        r#"{{"action":"create","kind":"call","underlying":"{WNEAR}","quote":"{WNEAR}","underlying_per_option":"10","strike_per_option":"50","expiry_ns":"{}"}}"#,
        NOW + HOUR_NS
    );
    via_intents(&mut contract, &alice(), WNEAR, 35, &msg);
}

#[test]
#[should_panic(expected = "ERR_ZERO")]
fn create_with_zero_size_refused() {
    let mut contract = setup();
    let msg = format!(
        r#"{{"action":"create","kind":"call","underlying":"{WNEAR}","quote":"{USDC}","underlying_per_option":"0","strike_per_option":"50","expiry_ns":"{}"}}"#,
        NOW + HOUR_NS
    );
    via_intents(&mut contract, &alice(), WNEAR, 35, &msg);
}

#[test]
#[should_panic(expected = "ERR_ZERO")]
fn create_buying_zero_options_refused() {
    let mut contract = setup();
    via_intents(
        &mut contract,
        &alice(),
        WNEAR,
        9,
        &create_call_msg(NOW + HOUR_NS),
    );
}

#[test]
#[should_panic(expected = "ERR_BAD_EXPIRY")]
fn create_expiring_too_soon_refused() {
    let mut contract = setup();
    via_intents(
        &mut contract,
        &alice(),
        WNEAR,
        35,
        &create_call_msg(NOW + 30 * 1_000_000_000),
    );
}

#[test]
#[should_panic(expected = "ERR_BAD_EXPIRY")]
fn create_expiring_too_late_refused() {
    let mut contract = setup();
    via_intents(
        &mut contract,
        &alice(),
        WNEAR,
        35,
        &create_call_msg(NOW + MAX_EXPIRY_NS + 1),
    );
}

#[test]
#[should_panic(expected = "ERR_BELOW_MIN")]
fn create_below_minimum_refused() {
    let mut contract = setup();
    set_ctx(&owner(), 1, NOW);
    contract.allow_token(WNEAR.to_string(), U128(100));
    via_intents(
        &mut contract,
        &alice(),
        WNEAR,
        35,
        &create_call_msg(NOW + HOUR_NS),
    );
}

#[test]
fn writer_can_write_more() {
    let mut contract = with_call_series();
    let refund = via_intents(
        &mut contract,
        &alice(),
        WNEAR,
        21,
        r#"{"action":"write","series_id":"1"}"#,
    );
    assert_eq!(refund, 1);
    assert_eq!(series(&contract, 1).long_supply.0, 5);
    assert_eq!(longs(&contract, &alice(), 1), 5);
    assert_backed(&contract, 1);
}

#[test]
#[should_panic(expected = "ERR_NOT_WRITER")]
fn write_by_non_writer_refused() {
    let mut contract = with_call_series();
    via_intents(
        &mut contract,
        &bob(),
        WNEAR,
        20,
        r#"{"action":"write","series_id":"1"}"#,
    );
}

#[test]
#[should_panic(expected = "ERR_EXPIRED")]
fn write_after_expiry_refused() {
    let mut contract = with_call_series();
    set_ctx(&intents(), 0, NOW + HOUR_NS);
    via_intents_at(
        &mut contract,
        &alice(),
        WNEAR,
        20,
        r#"{"action":"write","series_id":"1"}"#,
    );
}

#[test]
#[should_panic(expected = "ERR_UNKNOWN_SERIES")]
fn write_to_unknown_series_refused() {
    let mut contract = with_call_series();
    via_intents(
        &mut contract,
        &alice(),
        WNEAR,
        20,
        r#"{"action":"write","series_id":"9"}"#,
    );
}

// ---------- offers ----------

fn with_offer() -> Contract {
    let mut contract = with_call_series();
    set_ctx(&alice(), 1, NOW);
    let offer_id = contract.list(U64(1), U128(2), U128(7));
    assert_eq!(offer_id, U64(1));
    contract
}

#[test]
fn list_escrows_longs() {
    let contract = with_offer();
    assert_eq!(longs(&contract, &alice(), 1), 1);
    assert_eq!(longs(&contract, &options(), 1), 2);
    let offer = contract.get_offer(U64(1)).unwrap();
    assert_eq!(offer.remaining.0, 2);
    assert_eq!(offer.price_token, USDC);
    assert_backed(&contract, 1);
}

#[test]
fn buy_moves_longs_and_refunds_overpayment() {
    let mut contract = with_offer();
    let refund = via_intents(
        &mut contract,
        &bob(),
        USDC,
        10,
        r#"{"action":"buy","offer_id":"1","amount":"1"}"#,
    );
    assert_eq!(refund, 3);
    assert_eq!(longs(&contract, &bob(), 1), 1);
    assert_eq!(contract.get_offer(U64(1)).unwrap().remaining.0, 1);
    let refund = via_intents(
        &mut contract,
        &bob(),
        USDC,
        7,
        r#"{"action":"buy","offer_id":"1","amount":"1"}"#,
    );
    assert_eq!(refund, 0);
    assert!(
        contract.get_offer(U64(1)).is_none(),
        "sold-out offer is removed"
    );
    assert_eq!(longs(&contract, &bob(), 1), 2);
    assert_backed(&contract, 1);
}

#[test]
#[should_panic(expected = "ERR_INSUFFICIENT_PAYMENT")]
fn underpaid_buy_refused() {
    let mut contract = with_offer();
    via_intents(
        &mut contract,
        &bob(),
        USDC,
        13,
        r#"{"action":"buy","offer_id":"1","amount":"2"}"#,
    );
}

#[test]
#[should_panic(expected = "ERR_OFFER_AMOUNT")]
fn buying_more_than_offered_refused() {
    let mut contract = with_offer();
    via_intents(
        &mut contract,
        &bob(),
        USDC,
        100,
        r#"{"action":"buy","offer_id":"1","amount":"3"}"#,
    );
}

#[test]
#[should_panic(expected = "ERR_WRONG_TOKEN")]
fn buy_with_wrong_token_refused() {
    let mut contract = with_offer();
    via_intents(
        &mut contract,
        &bob(),
        WNEAR,
        100,
        r#"{"action":"buy","offer_id":"1","amount":"1"}"#,
    );
}

#[test]
#[should_panic(expected = "ERR_UNKNOWN_OFFER")]
fn buy_unknown_offer_refused() {
    let mut contract = with_offer();
    via_intents(
        &mut contract,
        &bob(),
        USDC,
        100,
        r#"{"action":"buy","offer_id":"7","amount":"1"}"#,
    );
}

#[test]
#[should_panic(expected = "ERR_EXPIRED")]
fn buy_after_expiry_refused() {
    let mut contract = with_offer();
    set_ctx(&intents(), 0, NOW + HOUR_NS);
    via_intents_at(
        &mut contract,
        &bob(),
        USDC,
        7,
        r#"{"action":"buy","offer_id":"1","amount":"1"}"#,
    );
}

#[test]
#[should_panic(expected = "ERR_INSUFFICIENT_LONGS")]
fn listing_more_than_held_refused() {
    let mut contract = with_call_series();
    set_ctx(&alice(), 1, NOW);
    contract.list(U64(1), U128(4), U128(7));
}

#[test]
fn seller_cancels_offer() {
    let mut contract = with_offer();
    set_ctx(&alice(), 1, NOW);
    contract.cancel_offer(U64(1));
    assert!(contract.get_offer(U64(1)).is_none());
    assert_eq!(longs(&contract, &alice(), 1), 3);
}

#[test]
#[should_panic(expected = "ERR_NOT_SELLER")]
fn cancel_by_non_seller_refused() {
    let mut contract = with_offer();
    set_ctx(&bob(), 1, NOW);
    contract.cancel_offer(U64(1));
}

// ---------- exercise ----------

fn bob_holds_two() -> Contract {
    let mut contract = with_offer();
    via_intents(
        &mut contract,
        &bob(),
        USDC,
        14,
        r#"{"action":"buy","offer_id":"1","amount":"2"}"#,
    );
    contract
}

#[test]
fn exercise_call_burns_longs_and_books_proceeds() {
    let mut contract = bob_holds_two();
    let refund = via_intents(
        &mut contract,
        &bob(),
        USDC,
        55,
        r#"{"action":"exercise","series_id":"1","amount":"1"}"#,
    );
    assert_eq!(refund, 5);
    assert_eq!(longs(&contract, &bob(), 1), 1);
    let s = series(&contract, 1);
    assert_eq!(s.long_supply.0, 2);
    assert_eq!(s.collateral_held.0, 20);
    assert_eq!(s.proceeds_held.0, 50);
    assert_eq!(s.exercised.0, 1);
    assert_backed(&contract, 1);
    assert!(
        get_logs()
            .iter()
            .any(|l| l.contains(r#""event":"exercise""#))
    );
}

#[test]
fn exercise_put_pays_strike_from_collateral() {
    let mut contract = setup();
    via_intents(
        &mut contract,
        &alice(),
        USDC,
        100,
        &create_put_msg(NOW + HOUR_NS),
    );
    set_ctx(&alice(), 1, NOW);
    contract.mt_transfer(bob(), "1".to_string(), U128(1), None, None);
    let refund = via_intents(
        &mut contract,
        &bob(),
        WNEAR,
        10,
        r#"{"action":"exercise","series_id":"1","amount":"1"}"#,
    );
    assert_eq!(refund, 0);
    let s = series(&contract, 1);
    assert_eq!(s.collateral_held.0, 50);
    assert_eq!(s.proceeds_held.0, 10);
    assert_backed(&contract, 1);
}

#[test]
#[should_panic(expected = "ERR_INSUFFICIENT_LONGS")]
fn exercise_without_longs_refused() {
    let mut contract = with_call_series();
    via_intents(
        &mut contract,
        &bob(),
        USDC,
        50,
        r#"{"action":"exercise","series_id":"1","amount":"1"}"#,
    );
}

#[test]
#[should_panic(expected = "ERR_INSUFFICIENT_LONGS")]
fn exercising_the_same_longs_twice_refused() {
    let mut contract = bob_holds_two();
    via_intents(
        &mut contract,
        &bob(),
        USDC,
        100,
        r#"{"action":"exercise","series_id":"1","amount":"2"}"#,
    );
    assert_eq!(longs(&contract, &bob(), 1), 0);
    via_intents(
        &mut contract,
        &bob(),
        USDC,
        50,
        r#"{"action":"exercise","series_id":"1","amount":"1"}"#,
    );
}

#[test]
#[should_panic(expected = "ERR_EXPIRED")]
fn exercise_after_expiry_refused() {
    let mut contract = bob_holds_two();
    set_ctx(&intents(), 0, NOW + HOUR_NS);
    via_intents_at(
        &mut contract,
        &bob(),
        USDC,
        50,
        r#"{"action":"exercise","series_id":"1","amount":"1"}"#,
    );
}

#[test]
#[should_panic(expected = "ERR_INSUFFICIENT_PAYMENT")]
fn underpaid_exercise_refused() {
    let mut contract = bob_holds_two();
    via_intents(
        &mut contract,
        &bob(),
        USDC,
        49,
        r#"{"action":"exercise","series_id":"1","amount":"1"}"#,
    );
}

#[test]
#[should_panic(expected = "ERR_WRONG_TOKEN")]
fn exercise_with_wrong_token_refused() {
    let mut contract = bob_holds_two();
    via_intents(
        &mut contract,
        &bob(),
        WNEAR,
        50,
        r#"{"action":"exercise","series_id":"1","amount":"1"}"#,
    );
}

// ---------- writer: close, proceeds, reclaim ----------

#[test]
fn writer_closes_unsold_longs() {
    let mut contract = with_call_series();
    set_ctx(&alice(), 1, NOW);
    let _ = contract.close(U64(1), U128(2));
    let s = series(&contract, 1);
    assert_eq!(s.long_supply.0, 1);
    assert_eq!(s.collateral_held.0, 10);
    assert_backed(&contract, 1);
}

#[test]
#[should_panic(expected = "ERR_INSUFFICIENT_LONGS")]
fn close_after_selling_longs_refused() {
    let mut contract = bob_holds_two();
    set_ctx(&alice(), 1, NOW);
    let _ = contract.close(U64(1), U128(2));
}

#[test]
#[should_panic(expected = "ERR_NOT_WRITER")]
fn close_by_holder_refused() {
    let mut contract = bob_holds_two();
    set_ctx(&bob(), 1, NOW);
    let _ = contract.close(U64(1), U128(1));
}

#[test]
#[should_panic(expected = "ERR_EXPIRED")]
fn close_after_expiry_refused() {
    let mut contract = with_call_series();
    set_ctx(&alice(), 1, NOW + HOUR_NS);
    let _ = contract.close(U64(1), U128(1));
}

#[test]
fn writer_withdraws_proceeds() {
    let mut contract = bob_holds_two();
    via_intents(
        &mut contract,
        &bob(),
        USDC,
        50,
        r#"{"action":"exercise","series_id":"1","amount":"1"}"#,
    );
    set_ctx(&alice(), 1, NOW);
    let _ = contract.withdraw_proceeds(U64(1));
    assert_eq!(series(&contract, 1).proceeds_held.0, 0);
}

#[test]
#[should_panic(expected = "ERR_NOTHING_TO_PAY")]
fn withdraw_without_proceeds_refused() {
    let mut contract = with_call_series();
    set_ctx(&alice(), 1, NOW);
    let _ = contract.withdraw_proceeds(U64(1));
}

#[test]
#[should_panic(expected = "ERR_NOT_EXPIRED")]
fn reclaim_before_expiry_refused() {
    let mut contract = bob_holds_two();
    set_ctx(&alice(), 1, NOW);
    let _ = contract.reclaim_collateral(U64(1));
}

#[test]
fn reclaim_after_expiry_takes_unexercised_collateral() {
    let mut contract = bob_holds_two();
    via_intents(
        &mut contract,
        &bob(),
        USDC,
        50,
        r#"{"action":"exercise","series_id":"1","amount":"1"}"#,
    );
    set_ctx(&alice(), 1, NOW + HOUR_NS);
    assert!(contract.reclaim_collateral(U64(1)).is_some());
    let s = series(&contract, 1);
    assert!(s.reclaimed && s.expired);
    assert_eq!(s.collateral_held.0, 0);
    assert_eq!(s.proceeds_held.0, 50, "proceeds stay until withdrawn");
}

#[test]
#[should_panic(expected = "ERR_ALREADY_RECLAIMED")]
fn second_reclaim_refused() {
    let mut contract = with_call_series();
    set_ctx(&alice(), 1, NOW + HOUR_NS);
    let _ = contract.reclaim_collateral(U64(1));
    let _ = contract.reclaim_collateral(U64(1));
}

#[test]
#[should_panic(expected = "ERR_NOT_WRITER")]
fn reclaim_by_non_writer_refused() {
    let mut contract = with_call_series();
    set_ctx(&bob(), 1, NOW + HOUR_NS);
    let _ = contract.reclaim_collateral(U64(1));
}

// ---------- NEP-245 position token ----------

#[test]
fn longs_transfer_between_holders() {
    let mut contract = with_call_series();
    set_ctx(&alice(), 1, NOW);
    contract.mt_transfer(
        bob(),
        "1".to_string(),
        U128(2),
        None,
        Some("gift".to_string()),
    );
    assert_eq!(longs(&contract, &alice(), 1), 1);
    assert_eq!(longs(&contract, &bob(), 1), 2);
    assert_eq!(
        series(&contract, 1).long_supply.0,
        3,
        "transfers don't change supply"
    );
    assert!(
        get_logs()
            .iter()
            .any(|l| l.contains(r#""event":"mt_transfer""#))
    );
}

#[test]
#[should_panic(expected = "Requires attached deposit of exactly 1 yoctoNEAR")]
fn transfer_without_one_yocto_refused() {
    let mut contract = with_call_series();
    set_ctx(&alice(), 0, NOW);
    contract.mt_transfer(bob(), "1".to_string(), U128(1), None, None);
}

#[test]
#[should_panic(expected = "ERR_SELF_TRANSFER")]
fn self_transfer_refused() {
    let mut contract = with_call_series();
    set_ctx(&alice(), 1, NOW);
    contract.mt_transfer(alice(), "1".to_string(), U128(1), None, None);
}

#[test]
#[should_panic(expected = "ERR_APPROVALS_NOT_SUPPORTED")]
fn approvals_refused() {
    let mut contract = with_call_series();
    set_ctx(&alice(), 1, NOW);
    contract.mt_transfer(bob(), "1".to_string(), U128(1), Some((bob(), 0)), None);
}

#[test]
fn unknown_token_ids_read_as_empty() {
    let contract = with_call_series();
    assert_eq!(contract.mt_balance_of(alice(), "nope".to_string()), U128(0));
    assert_eq!(contract.mt_supply("9".to_string()), None);
    assert_eq!(
        contract.mt_token(vec!["1".to_string(), "9".to_string()]),
        vec![
            Some(defuse_nep245::Token {
                token_id: "1".to_string(),
                owner_id: None
            }),
            None
        ]
    );
}

#[test]
fn resolve_refunds_everything_when_receiver_fails() {
    let mut contract = with_call_series();
    set_ctx(&alice(), 1, NOW);
    contract.mt_transfer(bob(), "1".to_string(), U128(2), None, None);
    // Bob received 2 via transfer_call and the receiver failed: all 2 go back to Alice.
    set_ctx_with_result(&options(), PromiseResult::Failed);
    let kept = contract.mt_resolve_transfer(
        vec![alice()],
        bob(),
        vec!["1".to_string()],
        vec![U128(2)],
        None,
    );
    assert_eq!(kept, vec![U128(0)]);
    assert_eq!(longs(&contract, &alice(), 1), 3);
    assert_eq!(longs(&contract, &bob(), 1), 0);
}

#[test]
fn resolve_refunds_what_receiver_returns() {
    let mut contract = with_call_series();
    set_ctx(&alice(), 1, NOW);
    contract.mt_transfer(bob(), "1".to_string(), U128(2), None, None);
    set_ctx_with_result(&options(), PromiseResult::Successful(br#"["1"]"#.to_vec()));
    let kept = contract.mt_resolve_transfer(
        vec![alice()],
        bob(),
        vec!["1".to_string()],
        vec![U128(2)],
        None,
    );
    assert_eq!(kept, vec![U128(1)]);
    assert_eq!(longs(&contract, &alice(), 1), 2);
    assert_eq!(longs(&contract, &bob(), 1), 1);
}

#[test]
#[should_panic(expected = "ERR_PRIVATE")]
fn resolve_is_private() {
    let mut contract = with_call_series();
    set_ctx(&bob(), 0, NOW);
    contract.mt_resolve_transfer(
        vec![alice()],
        bob(),
        vec!["1".to_string()],
        vec![U128(1)],
        None,
    );
}

// ---------- payouts ----------

#[test]
fn failed_payout_is_owed_and_retryable() {
    let mut contract = with_call_series();
    set_ctx_with_result(&options(), PromiseResult::Failed);
    contract.on_payout(bob(), USDC.to_string(), U128(42));
    assert_eq!(contract.get_owed(bob(), USDC.to_string()), U128(42));
    assert!(
        get_logs()
            .iter()
            .any(|l| l.contains(r#""event":"payout_failed""#))
    );

    set_ctx(&bob(), 1, NOW);
    let _ = contract.retry_payout(USDC.to_string());
    assert_eq!(contract.get_owed(bob(), USDC.to_string()), U128(0));
}

#[test]
fn successful_payout_owes_nothing() {
    let mut contract = with_call_series();
    set_ctx_with_result(&options(), PromiseResult::Successful(vec![]));
    contract.on_payout(bob(), USDC.to_string(), U128(42));
    assert_eq!(contract.get_owed(bob(), USDC.to_string()), U128(0));
}

#[test]
#[should_panic(expected = "ERR_NOTHING_TO_PAY")]
fn retry_without_owed_refused() {
    let mut contract = with_call_series();
    set_ctx(&bob(), 1, NOW);
    let _ = contract.retry_payout(USDC.to_string());
}

// ---------- signed actions (on_auth, D-030) ----------

/// An EVM wallet's Intents account. No NEAR account stands behind it.
fn evm() -> AccountId {
    acc("0x17c5185167401ed00cf5f5b2fc97d9bbfdb7d025")
}

/// Simulates `intents.near` running an `auth_call` intent signed by `signer`, with no deposit.
fn on_auth_at(
    contract: &mut Contract,
    signer: &AccountId,
    msg: &str,
    now: u64,
) -> PromiseOrValue<()> {
    set_ctx(&intents(), 0, now);
    contract.on_auth(signer.clone(), msg.to_string())
}

fn on_auth(contract: &mut Contract, signer: &AccountId, msg: &str) -> PromiseOrValue<()> {
    on_auth_at(contract, signer, msg, NOW)
}

/// The EVM wallet writes 3 calls with a signed `transfer` (Intents calls `mt_on_transfer` with
/// the signer as `sender_id`). Returns series 1.
fn evm_writes() -> Contract {
    let mut contract = setup();
    let refund = via_intents(
        &mut contract,
        &evm(),
        WNEAR,
        30,
        &create_call_msg(NOW + HOUR_NS),
    );
    assert_eq!(refund, 0);
    assert_eq!(series(&contract, 1).writer, evm());
    contract
}

#[test]
#[should_panic(expected = "ERR_NOT_INTENTS")]
fn on_auth_refused_unless_called_by_intents() {
    let mut contract = evm_writes();
    set_ctx(&alice(), 0, NOW + HOUR_NS);
    let _ = contract.on_auth(
        evm(),
        r#"{"action":"reclaim_collateral","series_id":"1"}"#.to_string(),
    );
}

#[test]
#[should_panic(expected = "ERR_BAD_MSG")]
fn on_auth_without_a_signed_action_refused() {
    // Exercise moves tokens, so it only arrives as a `transfer`, never as `on_auth`.
    let mut contract = evm_writes();
    let _ = on_auth(
        &mut contract,
        &evm(),
        r#"{"action":"exercise","series_id":"1","amount":"1"}"#,
    );
}

#[test]
fn signed_list_and_cancel_act_for_the_signer() {
    let mut contract = evm_writes();
    let _ = on_auth(
        &mut contract,
        &evm(),
        r#"{"action":"list","series_id":"1","amount":"2","price_per_option":"7"}"#,
    );
    assert_eq!(contract.get_offer(U64(1)).unwrap().seller, evm());
    assert_eq!(longs(&contract, &evm(), 1), 1);
    assert_eq!(longs(&contract, &options(), 1), 2);

    let _ = on_auth(
        &mut contract,
        &evm(),
        r#"{"action":"cancel_offer","offer_id":"1"}"#,
    );
    assert!(contract.get_offer(U64(1)).is_none());
    assert_eq!(longs(&contract, &evm(), 1), 3);
}

#[test]
#[should_panic(expected = "ERR_NOT_SELLER")]
fn signed_cancel_of_someone_elses_offer_refused() {
    let mut contract = with_offer();
    let _ = on_auth(
        &mut contract,
        &evm(),
        r#"{"action":"cancel_offer","offer_id":"1"}"#,
    );
}

#[test]
fn signed_close_acts_for_the_writer() {
    let mut contract = evm_writes();
    let result = on_auth(
        &mut contract,
        &evm(),
        r#"{"action":"close","series_id":"1","amount":"1"}"#,
    );
    assert!(matches!(result, PromiseOrValue::Promise(_)));
    assert_eq!(series(&contract, 1).long_supply.0, 2);
    assert_backed(&contract, 1);
}

#[test]
fn signed_withdraw_pays_the_writer() {
    let mut contract = evm_writes();
    let _ = on_auth(
        &mut contract,
        &evm(),
        r#"{"action":"list","series_id":"1","amount":"2","price_per_option":"7"}"#,
    );
    via_intents(
        &mut contract,
        &bob(),
        USDC,
        14,
        r#"{"action":"buy","offer_id":"1","amount":"2"}"#,
    );
    via_intents(
        &mut contract,
        &bob(),
        USDC,
        50,
        r#"{"action":"exercise","series_id":"1","amount":"1"}"#,
    );
    let result = on_auth(
        &mut contract,
        &evm(),
        r#"{"action":"withdraw_proceeds","series_id":"1"}"#,
    );
    assert!(matches!(result, PromiseOrValue::Promise(_)));
    assert_eq!(series(&contract, 1).proceeds_held.0, 0);
}

#[test]
#[should_panic(expected = "ERR_NOTHING_TO_PAY")]
fn signed_withdraw_without_proceeds_refused() {
    let mut contract = evm_writes();
    let _ = on_auth(
        &mut contract,
        &evm(),
        r#"{"action":"withdraw_proceeds","series_id":"1"}"#,
    );
}

#[test]
#[should_panic(expected = "ERR_NOT_EXPIRED")]
fn signed_reclaim_before_expiry_refused() {
    let mut contract = evm_writes();
    let _ = on_auth(
        &mut contract,
        &evm(),
        r#"{"action":"reclaim_collateral","series_id":"1"}"#,
    );
}

#[test]
fn signed_reclaim_after_expiry_pays_the_writer() {
    let mut contract = evm_writes();
    let result = on_auth_at(
        &mut contract,
        &evm(),
        r#"{"action":"reclaim_collateral","series_id":"1"}"#,
        NOW + HOUR_NS,
    );
    assert!(matches!(result, PromiseOrValue::Promise(_)));
    let s = series(&contract, 1);
    assert!(s.reclaimed);
    assert_eq!(s.collateral_held.0, 0);
}

#[test]
#[should_panic(expected = "ERR_NOT_WRITER")]
fn signed_reclaim_of_someone_elses_series_refused() {
    let mut contract = with_call_series();
    let _ = on_auth_at(
        &mut contract,
        &evm(),
        r#"{"action":"reclaim_collateral","series_id":"1"}"#,
        NOW + HOUR_NS,
    );
}

#[test]
#[should_panic(expected = "ERR_NOTHING_TO_PAY")]
fn signed_retry_without_owed_refused() {
    let mut contract = evm_writes();
    let _ = on_auth(
        &mut contract,
        &evm(),
        &format!(r#"{{"action":"retry_payout","token_id":"{WNEAR}"}}"#),
    );
}

#[test]
fn signed_transfer_call_moves_the_signers_longs() {
    let mut contract = evm_writes();
    let result = on_auth(
        &mut contract,
        &evm(),
        &format!(
            r#"{{"action":"mt_transfer_call","receiver_id":"{}","token_id":"1","amount":"2"}}"#,
            intents()
        ),
    );
    assert!(matches!(result, PromiseOrValue::Promise(_)));
    assert_eq!(longs(&contract, &evm(), 1), 1);
    assert_eq!(longs(&contract, &intents(), 1), 2);
}

#[test]
#[should_panic(expected = "ERR_INSUFFICIENT_LONGS")]
fn signed_transfer_call_beyond_holdings_refused() {
    let mut contract = evm_writes();
    let _ = on_auth(
        &mut contract,
        &evm(),
        &format!(
            r#"{{"action":"mt_transfer_call","receiver_id":"{}","token_id":"1","amount":"4"}}"#,
            intents()
        ),
    );
}

// ---------- owner ----------

#[test]
#[should_panic(expected = "ERR_NOT_OWNER")]
fn allowlist_is_owner_only() {
    let mut contract = setup();
    set_ctx(&alice(), 1, NOW);
    contract.allow_token("nep141:junk.near".to_string(), U128(1));
}

#[test]
fn config_lists_allowed_tokens() {
    let contract = setup();
    let config = contract.get_config();
    assert_eq!(config.intents_id, intents());
    assert_eq!(config.allowed_tokens.len(), 2);
}
