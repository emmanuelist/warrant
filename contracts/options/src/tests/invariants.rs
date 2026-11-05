//! Randomized sequences of everything the contract can be asked to do, with docs/SPEC.md's
//! invariants checked after every step (#21, D-037).
//!
//! The money is checked against what actually leaves: the `mt_transfer` promises each call
//! schedules, not the contract's own events. A refused call rolls back the way it does on chain, by
//! restoring the storage from before it. A panic that isn't a named refusal fails the run.
//!
//! The run also counts what it reached, and fails if any action or refusal was never reached, so
//! it can't pass by exercising nothing. Same seeds, same run:
//!
//!   cargo test invariants -- --nocapture

use std::any::Any;
use std::cell::{Cell, RefCell};
use std::collections::{BTreeMap, HashMap};
use std::panic::{AssertUnwindSafe, catch_unwind};
use std::sync::Once;

use near_sdk::mock::{MockAction, with_mocked_blockchain};
use near_sdk::serde_json::{self, Value};
use near_sdk::test_utils::get_created_receipts;
use near_sdk::{MockedBlockchain, borsh, env};

use super::*;

const SEQUENCES: u64 = 256;
const STEPS: u64 = 128;
const MINUTE_NS: u64 = 60 * 1_000_000_000;
const OTHER: &str = "nep141:other.near";
const MIN_COLLATERAL: u128 = 3;

thread_local! {
    static QUIET: Cell<bool> = const { Cell::new(false) };
}
static HOOK: Once = Once::new();

/// Refused calls panic by design; keep them out of the test output, on this thread only.
fn quiet_panics() {
    HOOK.call_once(|| {
        let default = std::panic::take_hook();
        std::panic::set_hook(Box::new(move |info| {
            if !QUIET.with(Cell::get) {
                default(info);
            }
        }));
    });
}

/// `test_vm_config()` parses the protocol's parameter files on every call, and a step changes
/// context several times: once per thread is enough.
fn cached_vm_config<T: Clone + 'static>(make: impl FnOnce() -> T) -> T {
    thread_local! {
        static SLOT: RefCell<Option<Box<dyn Any>>> = const { RefCell::new(None) };
    }
    SLOT.with(|slot| {
        slot.borrow_mut()
            .get_or_insert_with(|| Box::new(make()))
            .downcast_ref::<T>()
            .unwrap()
            .clone()
    })
}

fn context(predecessor: &AccountId, deposit_yocto: u128, now: u64) -> near_sdk::VMContext {
    let mut builder = VMContextBuilder::new();
    builder
        .current_account_id(options())
        .signer_account_id(predecessor.clone())
        .predecessor_account_id(predecessor.clone())
        .attached_deposit(NearToken::from_yoctonear(deposit_yocto))
        .block_timestamp(now);
    builder.build()
}

/// As the parent module's, without re-parsing the VM config.
fn set_ctx(predecessor: &AccountId, deposit_yocto: u128, now: u64) {
    testing_env!(
        context(predecessor, deposit_yocto, now),
        cached_vm_config(near_sdk::test_vm_config)
    );
}

fn set_failed_promise(now: u64) {
    testing_env!(
        context(&options(), 0, now),
        cached_vm_config(near_sdk::test_vm_config),
        RuntimeFeesConfig::test(),
        Default::default(),
        vec![PromiseResult::Failed],
    );
}

/// Same seed, same sequence: xorshift64*.
struct Rng(u64);

impl Rng {
    fn next(&mut self) -> u64 {
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        self.0.wrapping_mul(0x9E37_79B9_7F4A_7C15)
    }
    fn below(&mut self, n: u64) -> u64 {
        self.next() % n
    }
    fn chance(&mut self, one_in: u64) -> bool {
        self.below(one_in) == 0
    }
    fn pick<'a, T>(&mut self, items: &'a [T]) -> &'a T {
        &items[self.below(items.len() as u64) as usize]
    }
}

fn carol() -> AccountId {
    acc("carol.near")
}

fn people() -> [AccountId; 3] {
    [alice(), bob(), carol()]
}

/// The storage is the chain's state: everything a refused call must not have touched.
struct Saved {
    contract: Vec<u8>,
    storage: HashMap<Vec<u8>, Vec<u8>>,
}

fn install(storage: HashMap<Vec<u8>, Vec<u8>>) {
    env::set_blockchain_interface(MockedBlockchain::new(
        context(&options(), 0, NOW),
        cached_vm_config(near_sdk::test_vm_config),
        RuntimeFeesConfig::test(),
        vec![],
        storage,
        Default::default(),
        None,
    ));
}

/// Dropping the contract flushes its collections' caches into storage, as the end of a call does.
fn save(contract: Contract) -> (Contract, Saved) {
    let bytes = borsh::to_vec(&contract).unwrap();
    drop(contract);
    let storage = with_mocked_blockchain(|b| b.take_storage());
    install(storage.clone());
    (
        borsh::from_slice(&bytes).unwrap(),
        Saved {
            contract: bytes,
            storage,
        },
    )
}

fn restore(saved: Saved) -> Contract {
    install(saved.storage);
    borsh::from_slice(&saved.contract).unwrap()
}

/// What a call asked Intents to move out of the contract: `(receiver, token, amount)`.
fn scheduled_payouts() -> Vec<(AccountId, String, u128)> {
    get_created_receipts()
        .iter()
        .filter(|receipt| receipt.receiver_id == intents())
        .flat_map(|receipt| receipt.actions.iter())
        .filter_map(|action| match action {
            MockAction::FunctionCallWeight {
                method_name, args, ..
            } if method_name == b"mt_transfer" => {
                let args: Value = serde_json::from_slice(args).unwrap();
                Some((
                    args["receiver_id"].as_str().unwrap().parse().unwrap(),
                    args["token_id"].as_str().unwrap().to_string(),
                    args["amount"].as_str().unwrap().parse().unwrap(),
                ))
            }
            _ => None,
        })
        .collect()
}

/// What this model knows that the contract's books don't get to decide.
#[derive(Default)]
struct World {
    now: u64,
    /// The contract's balance inside Intents: what came in, less what left.
    inside_intents: BTreeMap<String, u128>,
    /// Proceeds paid out, per series.
    withdrawn: BTreeMap<u64, u128>,
    /// Collateral per series after the last accepted step.
    collateral: BTreeMap<u64, u128>,
}

/// One thing somebody tries. `Kind` names it for the counters and the rules about who gets paid.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Kind {
    Create,
    Write,
    List,
    Cancel,
    Buy,
    Exercise,
    Close,
    Withdraw,
    Reclaim,
    Transfer,
    Retry,
    Forged,
}

impl Kind {
    fn name(self) -> &'static str {
        match self {
            Kind::Create => "create",
            Kind::Write => "write",
            Kind::List => "list",
            Kind::Cancel => "cancel_offer",
            Kind::Buy => "buy",
            Kind::Exercise => "exercise",
            Kind::Close => "close",
            Kind::Withdraw => "withdraw_proceeds",
            Kind::Reclaim => "reclaim_collateral",
            Kind::Transfer => "mt_transfer",
            Kind::Retry => "retry_payout",
            Kind::Forged => "forged",
        }
    }
}

/// What a step does, at the chain's clock. A transfer through Intents returns `(token, sent, refund)`.
type Call = Box<dyn FnOnce(&mut Contract, u64) -> Option<(String, u128, u128)>>;

struct Attempt {
    kind: Kind,
    actor: AccountId,
    series_id: Option<u64>,
    /// Who the money may go to, when the call pays out.
    pays: Option<AccountId>,
    call: Call,
}

fn intents_call(sender: AccountId, token: String, amount: u128, msg: String) -> Call {
    Box::new(move |contract, now| {
        set_ctx(&intents(), 0, now);
        let refund = via_intents_at(contract, &sender, &token, amount, &msg);
        Some((token, amount, refund))
    })
}

/// A direct call with its yocto, or the same call relayed through `on_auth`, which must behave alike.
fn direct_or_signed(
    rng: &mut Rng,
    actor: AccountId,
    direct: impl FnOnce(&mut Contract) + 'static,
    signed: Value,
) -> Call {
    if rng.chance(3) {
        Box::new(move |contract, now| {
            set_ctx(&intents(), 0, now);
            let _ = contract.on_auth(actor, signed.to_string());
            None
        })
    } else {
        Box::new(move |contract, now| {
            set_ctx(&actor, 1, now);
            direct(contract);
            None
        })
    }
}

fn draw(rng: &mut Rng, contract: &Contract, world: &World) -> Attempt {
    let everyone = people();
    let actor = rng.pick(&everyone).clone();
    let list = contract.get_series_list(None, Some(U64(100)));
    let offers = contract.get_offers(None, Some(U64(100)));
    // Mostly real ids, sometimes one that doesn't exist.
    let series = if rng.chance(12) || list.is_empty() {
        None
    } else {
        Some(rng.pick(&list).clone())
    };
    let series_id = series.as_ref().map_or(999, |s| s.series_id.0);
    let writer = series.as_ref().map(|s| s.writer.clone());
    // Usually the one entitled to act, so sequences go deep; sometimes anyone at all.
    let writer_or_anyone = writer
        .clone()
        .filter(|_| !rng.chance(5))
        .unwrap_or_else(|| actor.clone());
    let amount = 1 + rng.below(4) as u128;

    match rng.below(24) {
        0..=3 => {
            let kind = if rng.chance(3) { "put" } else { "call" };
            let per = 1 + rng.below(9) as u128;
            let strike = 1 + rng.below(9) as u128;
            let mut underlying = WNEAR.to_string();
            let mut quote = USDC.to_string();
            let mut expiry = world.now + MINUTE_NS * (2 + rng.below(120));
            let mut token = if kind == "call" { WNEAR } else { USDC };
            let collateral = if kind == "call" { per } else { strike };
            let mut paid =
                collateral * (1 + rng.below(5) as u128) + rng.below(collateral as u64 + 1) as u128;
            // Now and then, something the contract must refuse.
            match rng.below(16) {
                0 => underlying = quote.clone(),
                1 => quote = OTHER.to_string(),
                2 => expiry = world.now,
                3 => expiry = world.now + 400 * 24 * 60 * MINUTE_NS,
                4 => token = OTHER,
                5 => paid = rng.below(2) as u128 + 1,
                _ => {}
            }
            let msg = format!(
                r#"{{"action":"create","kind":"{kind}","underlying":"{underlying}","quote":"{quote}","underlying_per_option":"{per}","strike_per_option":"{strike}","expiry_ns":"{expiry}"}}"#
            );
            Attempt {
                kind: Kind::Create,
                actor: actor.clone(),
                series_id: None,
                pays: None,
                call: intents_call(actor, token.to_string(), paid, msg),
            }
        }
        4 | 5 => {
            let (token, per) = series.as_ref().map_or((WNEAR.to_string(), 1), |s| {
                (s.collateral_token.clone(), s.collateral_per_option.0)
            });
            let paid = per * amount + rng.below(per as u64 + 1) as u128;
            let msg = format!(r#"{{"action":"write","series_id":"{series_id}"}}"#);
            Attempt {
                kind: Kind::Write,
                actor: writer_or_anyone.clone(),
                series_id: Some(series_id),
                pays: None,
                call: intents_call(writer_or_anyone, token, paid, msg),
            }
        }
        6 | 7 => {
            let price = if rng.chance(20) {
                1u128 << 127
            } else {
                1 + rng.below(9) as u128
            };
            let who = writer_or_anyone.clone();
            Attempt {
                kind: Kind::List,
                actor: who.clone(),
                series_id: Some(series_id),
                pays: None,
                call: direct_or_signed(
                    rng,
                    who,
                    move |contract| {
                        contract.list(U64(series_id), U128(amount), U128(price));
                    },
                    near_sdk::serde_json::json!({"action": "list", "series_id": series_id.to_string(), "amount": amount.to_string(), "price_per_option": price.to_string()}),
                ),
            }
        }
        8 => {
            let offer = if offers.is_empty() || rng.chance(8) {
                None
            } else {
                Some(rng.pick(&offers).clone())
            };
            let offer_id = offer.as_ref().map_or(999, |o| o.offer_id.0);
            let who = offer
                .as_ref()
                .map(|o| o.seller.clone())
                .filter(|_| !rng.chance(3))
                .unwrap_or_else(|| actor.clone());
            Attempt {
                kind: Kind::Cancel,
                actor: who.clone(),
                series_id: offer.as_ref().map(|o| o.series_id.0),
                pays: None,
                call: direct_or_signed(
                    rng,
                    who,
                    move |contract| contract.cancel_offer(U64(offer_id)),
                    near_sdk::serde_json::json!({"action": "cancel_offer", "offer_id": offer_id.to_string()}),
                ),
            }
        }
        9..=11 => {
            let offer = if offers.is_empty() || rng.chance(10) {
                None
            } else {
                Some(rng.pick(&offers).clone())
            };
            let offer_id = offer.as_ref().map_or(999, |o| o.offer_id.0);
            let want = offer.as_ref().map_or(1, |o| {
                if rng.chance(6) {
                    o.remaining.0 + 1
                } else {
                    1 + rng.below(o.remaining.0 as u64) as u128
                }
            });
            let price = offer.as_ref().map_or(1, |o| o.price_per_option.0);
            let token = offer
                .as_ref()
                .filter(|_| !rng.chance(10))
                .map_or(OTHER.to_string(), |o| o.price_token.clone());
            // An exact payment, an overpayment that must come back, or too little.
            let exact = price.saturating_mul(want).min(1 << 100);
            let paid = match rng.below(6) {
                0 => exact + 1 + rng.below(5) as u128,
                1 => exact.saturating_sub(1).max(1),
                _ => exact.max(1),
            };
            let msg = format!(r#"{{"action":"buy","offer_id":"{offer_id}","amount":"{want}"}}"#);
            Attempt {
                kind: Kind::Buy,
                actor: actor.clone(),
                series_id: offer.as_ref().map(|o| o.series_id.0),
                pays: offer.as_ref().map(|o| o.seller.clone()),
                call: intents_call(actor, token, paid, msg),
            }
        }
        12..=14 => {
            let holders: Vec<AccountId> = everyone
                .iter()
                .filter(|who| longs(contract, who, series_id) > 0)
                .cloned()
                .collect();
            let who = if holders.is_empty() || rng.chance(6) {
                actor.clone()
            } else {
                rng.pick(&holders).clone()
            };
            let held = longs(contract, &who, series_id);
            let exercise = if held > 0 && !rng.chance(8) {
                1 + rng.below(held as u64) as u128
            } else {
                held + 1
            };
            let (token, per) = series.as_ref().map_or((USDC.to_string(), 1), |s| {
                (s.payment_token.clone(), s.payment_per_option.0)
            });
            let token = if rng.chance(12) {
                OTHER.to_string()
            } else {
                token
            };
            let exact = per * exercise;
            let paid = match rng.below(6) {
                0 => exact + 1 + rng.below(5) as u128,
                1 => exact.saturating_sub(1).max(1),
                _ => exact,
            };
            // The delivery may go to someone else, by the holder's own choice.
            let receiver = if rng.chance(4) {
                rng.pick(&everyone).clone()
            } else {
                who.clone()
            };
            let msg = if rng.chance(30) {
                "not an action".to_string()
            } else {
                format!(
                    r#"{{"action":"exercise","series_id":"{series_id}","amount":"{}","receiver_id":"{receiver}"}}"#,
                    if rng.chance(30) { 0 } else { exercise }
                )
            };
            Attempt {
                kind: Kind::Exercise,
                actor: who.clone(),
                series_id: Some(series_id),
                pays: Some(receiver),
                call: intents_call(who, token, paid, msg),
            }
        }
        15 => {
            let who = writer_or_anyone.clone();
            let held = longs(contract, &who, series_id);
            let close = if held > 0 && !rng.chance(6) {
                1 + rng.below(held as u64) as u128
            } else {
                held + 1
            };
            Attempt {
                kind: Kind::Close,
                actor: who.clone(),
                series_id: Some(series_id),
                pays: writer.clone(),
                call: direct_or_signed(
                    rng,
                    who,
                    move |contract| {
                        let _ = contract.close(U64(series_id), U128(close));
                    },
                    near_sdk::serde_json::json!({"action": "close", "series_id": series_id.to_string(), "amount": close.to_string()}),
                ),
            }
        }
        16 => {
            let who = writer_or_anyone.clone();
            Attempt {
                kind: Kind::Withdraw,
                actor: who.clone(),
                series_id: Some(series_id),
                pays: writer.clone(),
                call: direct_or_signed(
                    rng,
                    who,
                    move |contract| {
                        let _ = contract.withdraw_proceeds(U64(series_id));
                    },
                    near_sdk::serde_json::json!({"action": "withdraw_proceeds", "series_id": series_id.to_string()}),
                ),
            }
        }
        17 | 18 => {
            let who = writer_or_anyone.clone();
            Attempt {
                kind: Kind::Reclaim,
                actor: who.clone(),
                series_id: Some(series_id),
                pays: writer.clone(),
                call: direct_or_signed(
                    rng,
                    who,
                    move |contract| {
                        let _ = contract.reclaim_collateral(U64(series_id));
                    },
                    near_sdk::serde_json::json!({"action": "reclaim_collateral", "series_id": series_id.to_string()}),
                ),
            }
        }
        19 | 20 => {
            let to = rng.pick(&everyone).clone();
            let held = longs(contract, &actor, series_id);
            let moved = if held > 0 && !rng.chance(6) {
                1 + rng.below(held as u64) as u128
            } else {
                held + 1
            };
            let approval = rng.chance(12).then(|| (to.clone(), 0));
            let sender = actor.clone();
            Attempt {
                kind: Kind::Transfer,
                actor,
                series_id: Some(series_id),
                pays: None,
                call: Box::new(move |contract, now| {
                    set_ctx(&sender, 1, now);
                    contract.mt_transfer(to, series_id.to_string(), U128(moved), approval, None);
                    None
                }),
            }
        }
        21 => {
            let token = rng.pick(&[WNEAR, USDC]).to_string();
            let who = actor.clone();
            Attempt {
                kind: Kind::Retry,
                actor: who.clone(),
                series_id: None,
                pays: Some(who.clone()),
                call: direct_or_signed(
                    rng,
                    who,
                    {
                        let token = token.clone();
                        move |contract| {
                            let _ = contract.retry_payout(token);
                        }
                    },
                    near_sdk::serde_json::json!({"action": "retry_payout", "token_id": token}),
                ),
            }
        }
        // Calls that claim an authority the caller doesn't have.
        _ => {
            let stranger = actor.clone();
            let which = rng.below(5);
            Attempt {
                kind: Kind::Forged,
                actor,
                series_id: None,
                pays: None,
                call: Box::new(move |contract, now| {
                    set_ctx(&stranger, if which == 0 { 0 } else { 1 }, now);
                    match which {
                        0 => {
                            let _ = contract.mt_on_transfer(
                                stranger.clone(),
                                vec![stranger.clone()],
                                vec![WNEAR.to_string()],
                                vec![U128(1_000)],
                                format!(r#"{{"action":"write","series_id":"{series_id}"}}"#),
                            );
                        }
                        1 => {
                            let _ = contract.on_auth(
                                stranger.clone(),
                                format!(
                                    r#"{{"action":"reclaim_collateral","series_id":"{series_id}"}}"#
                                ),
                            );
                        }
                        2 => contract.allow_token(OTHER.to_string(), U128(1)),
                        3 => {
                            set_ctx(&intents(), 0, now);
                            let _ = contract.mt_on_transfer(
                                stranger.clone(),
                                vec![stranger.clone(), stranger.clone()],
                                vec![WNEAR.to_string(), USDC.to_string()],
                                vec![U128(1), U128(1)],
                                String::new(),
                            );
                        }
                        _ => contract.mt_batch_transfer(
                            if stranger == alice() { bob() } else { alice() },
                            vec![series_id.to_string()],
                            vec![U128(1), U128(1)],
                            None,
                            None,
                        ),
                    }
                    None
                }),
            }
        }
    }
}

/// docs/SPEC.md's invariants, and who may have been paid, after a step the contract accepted.
fn check(
    contract: &Contract,
    world: &mut World,
    step: &str,
    kind: Kind,
    actor: &AccountId,
    series_id: Option<u64>,
) {
    let everyone = people();
    let list = contract.get_series_list(None, Some(U64(1_000)));
    let offers = contract.get_offers(None, Some(U64(1_000)));
    let mut books: BTreeMap<String, u128> = BTreeMap::new();

    for s in &list {
        let id = s.series_id.0;
        // 1. Fully backed until reclaimed.
        if s.reclaimed {
            assert_eq!(
                s.collateral_held.0, 0,
                "{step}: series {id} reclaimed but holds collateral"
            );
        } else {
            assert_eq!(
                s.collateral_held.0,
                s.long_supply.0 * s.collateral_per_option.0,
                "{step}: series {id} isn't fully backed"
            );
        }
        // 2. Proceeds are what exercises paid, less what was withdrawn.
        let withdrawn = world.withdrawn.get(&id).copied().unwrap_or(0);
        assert_eq!(
            s.proceeds_held.0 + withdrawn,
            s.exercised.0 * s.payment_per_option.0,
            "{step}: series {id} proceeds don't add up"
        );
        // Every long is in someone's hands or in escrow behind an offer, and nothing else.
        let escrowed: u128 = offers
            .iter()
            .filter(|o| o.series_id.0 == id)
            .map(|o| o.remaining.0)
            .sum();
        assert_eq!(
            longs(contract, &options(), id),
            escrowed,
            "{step}: series {id} escrow doesn't match its offers"
        );
        let in_hands: u128 = everyone.iter().map(|who| longs(contract, who, id)).sum();
        assert_eq!(
            in_hands + escrowed,
            s.long_supply.0,
            "{step}: series {id} longs don't add up"
        );

        *books.entry(s.collateral_token.clone()).or_default() += s.collateral_held.0;
        *books.entry(s.payment_token.clone()).or_default() += s.proceeds_held.0;

        // The thesis: collateral leaves only by exercise before expiry, by the writer closing
        // their own longs before expiry, or by the writer reclaiming after it.
        let before = world
            .collateral
            .insert(id, s.collateral_held.0)
            .unwrap_or(0);
        if s.collateral_held.0 < before {
            assert_eq!(
                series_id,
                Some(id),
                "{step}: series {id} lost collateral to a call about something else"
            );
            let expired = world.now >= s.expiry_ns.0;
            match kind {
                Kind::Exercise => assert!(!expired, "{step}: series {id} exercised after expiry"),
                Kind::Close => {
                    assert!(!expired, "{step}: series {id} closed after expiry");
                    assert_eq!(
                        actor, &s.writer,
                        "{step}: series {id} closed by someone else"
                    );
                }
                Kind::Reclaim => {
                    assert!(expired, "{step}: series {id} reclaimed before expiry");
                    assert_eq!(
                        actor, &s.writer,
                        "{step}: series {id} reclaimed by someone else"
                    );
                }
                _ => panic!("{step}: series {id} lost collateral to {}", kind.name()),
            }
        }
    }

    // 3. The money: the contract's balance inside Intents is its books, to the unit.
    for who in &everyone {
        for token in [WNEAR, USDC] {
            *books.entry(token.to_string()).or_default() +=
                contract.get_owed(who.clone(), token.to_string()).0;
        }
    }
    for token in [WNEAR, USDC, OTHER] {
        assert_eq!(
            world.inside_intents.get(token).copied().unwrap_or(0),
            books.get(token).copied().unwrap_or(0),
            "{step}: {token} inside Intents doesn't match the books"
        );
    }
}

#[test]
fn invariants_hold_across_random_sequences() {
    quiet_panics();
    let mut accepted: BTreeMap<&str, u64> = BTreeMap::new();
    let mut refused: BTreeMap<String, u64> = BTreeMap::new();
    let (mut paid_out, mut failed_payouts, mut steps) = (0u64, 0u64, 0u64);
    let setting = |name: &str, default: u64| {
        std::env::var(name)
            .ok()
            .and_then(|v| v.parse().ok())
            .unwrap_or(default)
    };
    let sequences = setting("INVARIANT_SEQUENCES", SEQUENCES);
    let length = setting("INVARIANT_STEPS", STEPS);

    for seed in 1..=sequences {
        // A new chain for every sequence.
        install(HashMap::new());
        set_ctx(&owner(), 0, NOW);
        let mut contract = Contract::new(owner(), intents());
        set_ctx(&owner(), 1, NOW);
        contract.allow_token(WNEAR.to_string(), U128(MIN_COLLATERAL));
        contract.allow_token(USDC.to_string(), U128(MIN_COLLATERAL));
        let mut rng = Rng(seed.wrapping_mul(0x9E37_79B9_7F4A_7C15) | 1);
        let mut world = World {
            now: NOW,
            ..World::default()
        };

        for step in 0..length {
            steps += 1;
            let at = format!("seed {seed} step {step}");
            // Slowly enough that most series spend most of a sequence alive.
            if rng.chance(3) {
                world.now += MINUTE_NS * rng.below(5);
            }

            let attempt = draw(&mut rng, &contract, &world);
            let (kind, actor, series_id, pays) =
                (attempt.kind, attempt.actor, attempt.series_id, attempt.pays);
            let saved;
            (contract, saved) = save(contract);

            let now = world.now;
            QUIET.with(|quiet| quiet.set(true));
            let result = catch_unwind(AssertUnwindSafe(|| (attempt.call)(&mut contract, now)));
            QUIET.with(|quiet| quiet.set(false));

            match result {
                Err(panic) => {
                    let text = panic
                        .downcast_ref::<String>()
                        .cloned()
                        .or_else(|| panic.downcast_ref::<&str>().map(|s| s.to_string()))
                        .unwrap_or_default();
                    let code = text
                        .split(|c: char| !(c.is_ascii_uppercase() || c == '_'))
                        .find(|word| word.starts_with("ERR_"))
                        .map(str::to_string);
                    let Some(code) = code else {
                        panic!(
                            "{at}: {} panicked with something other than a named refusal: {text}",
                            kind.name()
                        );
                    };
                    *refused.entry(code).or_default() += 1;
                    // The chain reverts a failed call: nothing it did survives.
                    contract = restore(saved);
                }
                Ok(deposit) => {
                    *accepted.entry(kind.name()).or_default() += 1;
                    if let Some((token, amount, refund)) = deposit {
                        assert!(refund <= amount, "{at}: refunded more than was sent");
                        *world.inside_intents.entry(token).or_default() += amount - refund;
                    }
                    for (receiver, token, amount) in scheduled_payouts() {
                        if let Some(entitled) = &pays {
                            assert_eq!(
                                &receiver,
                                entitled,
                                "{at}: {} paid the wrong account",
                                kind.name()
                            );
                        } else {
                            panic!(
                                "{at}: {} paid {receiver}, and it shouldn't pay anyone",
                                kind.name()
                            );
                        }
                        if kind == Kind::Withdraw {
                            *world.withdrawn.entry(series_id.unwrap()).or_default() += amount;
                        }
                        // One payout in eight fails at Intents and stays owed, with the money still here.
                        if rng.chance(8) {
                            failed_payouts += 1;
                            set_failed_promise(world.now);
                            contract.on_payout(receiver, token, U128(amount));
                        } else {
                            paid_out += 1;
                            let inside = world.inside_intents.entry(token.clone()).or_default();
                            *inside = inside.checked_sub(amount).unwrap_or_else(|| {
                                panic!("{at}: paid out {amount} {token} the contract doesn't hold")
                            });
                        }
                    }
                    check(&contract, &mut world, &at, kind, &actor, series_id);
                }
            }
        }
    }

    println!(
        "{steps} steps across {sequences} sequences; {paid_out} payouts landed, {failed_payouts} failed and stayed owed"
    );
    println!("accepted: {accepted:?}");
    println!("refused:  {refused:?}");

    // A run that never reached something proved nothing about it.
    for kind in [
        Kind::Create,
        Kind::Write,
        Kind::List,
        Kind::Cancel,
        Kind::Buy,
        Kind::Exercise,
        Kind::Close,
        Kind::Withdraw,
        Kind::Reclaim,
        Kind::Transfer,
        Kind::Retry,
    ] {
        assert!(
            accepted.get(kind.name()).copied().unwrap_or(0) > 0,
            "{} was never accepted",
            kind.name()
        );
    }
    for code in [
        ERR_NOT_INTENTS,
        ERR_BATCH_NOT_SUPPORTED,
        ERR_BAD_MSG,
        ERR_TOKEN_NOT_ALLOWED,
        ERR_BELOW_MIN,
        ERR_SAME_TOKEN,
        ERR_ZERO,
        ERR_BAD_EXPIRY,
        ERR_UNKNOWN_SERIES,
        ERR_UNKNOWN_OFFER,
        ERR_WRONG_TOKEN,
        ERR_NOT_WRITER,
        ERR_NOT_SELLER,
        ERR_EXPIRED,
        ERR_NOT_EXPIRED,
        ERR_ALREADY_RECLAIMED,
        ERR_INSUFFICIENT_LONGS,
        ERR_INSUFFICIENT_PAYMENT,
        ERR_OFFER_AMOUNT,
        ERR_NOTHING_TO_PAY,
        ERR_NOT_OWNER,
        ERR_OVERFLOW,
        ERR_APPROVALS_NOT_SUPPORTED,
        ERR_SELF_TRANSFER,
        ERR_LENGTH_MISMATCH,
    ] {
        assert!(
            refused.get(code).copied().unwrap_or(0) > 0,
            "{code} was never reached"
        );
    }
}
