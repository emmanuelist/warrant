use near_sdk::json_types::{U64, U128};
use near_sdk::{AccountId, near};

use crate::types::OptionKind;

/// NEP-297 events, standard `intents_options` (docs/SPEC.md, "Events"). Position movements also
/// emit the standard `nep245` events from `defuse-nep245`.
#[near(event_json(standard = "intents_options"))]
pub enum OptionsEvent {
    #[event_version("1.0.0")]
    Create {
        series_id: U64,
        writer: AccountId,
        kind: OptionKind,
        underlying: String,
        quote: String,
        underlying_per_option: U128,
        strike_per_option: U128,
        expiry_ns: U64,
        amount: U128,
    },
    #[event_version("1.0.0")]
    Write {
        series_id: U64,
        writer: AccountId,
        amount: U128,
    },
    #[event_version("1.0.0")]
    List {
        offer_id: U64,
        series_id: U64,
        seller: AccountId,
        amount: U128,
        price_per_option: U128,
    },
    #[event_version("1.0.0")]
    CancelOffer {
        offer_id: U64,
        seller: AccountId,
        returned: U128,
    },
    #[event_version("1.0.0")]
    Buy {
        offer_id: U64,
        series_id: U64,
        buyer: AccountId,
        seller: AccountId,
        amount: U128,
        premium: U128,
    },
    #[event_version("1.0.0")]
    Exercise {
        series_id: U64,
        holder: AccountId,
        receiver_id: AccountId,
        amount: U128,
        paid: U128,
        delivered: U128,
    },
    #[event_version("1.0.0")]
    Close {
        series_id: U64,
        writer: AccountId,
        amount: U128,
        returned: U128,
    },
    #[event_version("1.0.0")]
    WithdrawProceeds {
        series_id: U64,
        writer: AccountId,
        amount: U128,
    },
    #[event_version("1.0.0")]
    ReclaimCollateral {
        series_id: U64,
        writer: AccountId,
        amount: U128,
    },
    #[event_version("1.0.0")]
    PayoutFailed {
        receiver_id: AccountId,
        token_id: String,
        amount: U128,
    },
    #[event_version("1.0.0")]
    PayoutRetried {
        receiver_id: AccountId,
        token_id: String,
        amount: U128,
    },
}
