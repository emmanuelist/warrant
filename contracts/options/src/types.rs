use near_sdk::json_types::{U64, U128};
use near_sdk::{AccountId, near};

pub type SeriesId = u64;
pub type OfferId = u64;

// Refusals. The exact strings are part of the interface (docs/SPEC.md, "Refusals").
pub const ERR_NOT_INTENTS: &str = "ERR_NOT_INTENTS";
pub const ERR_BATCH_NOT_SUPPORTED: &str = "ERR_BATCH_NOT_SUPPORTED";
pub const ERR_BAD_MSG: &str = "ERR_BAD_MSG";
pub const ERR_TOKEN_NOT_ALLOWED: &str = "ERR_TOKEN_NOT_ALLOWED";
pub const ERR_BELOW_MIN: &str = "ERR_BELOW_MIN";
pub const ERR_SAME_TOKEN: &str = "ERR_SAME_TOKEN";
pub const ERR_ZERO: &str = "ERR_ZERO";
pub const ERR_BAD_EXPIRY: &str = "ERR_BAD_EXPIRY";
pub const ERR_UNKNOWN_SERIES: &str = "ERR_UNKNOWN_SERIES";
pub const ERR_UNKNOWN_OFFER: &str = "ERR_UNKNOWN_OFFER";
pub const ERR_WRONG_TOKEN: &str = "ERR_WRONG_TOKEN";
pub const ERR_NOT_WRITER: &str = "ERR_NOT_WRITER";
pub const ERR_NOT_SELLER: &str = "ERR_NOT_SELLER";
pub const ERR_EXPIRED: &str = "ERR_EXPIRED";
pub const ERR_NOT_EXPIRED: &str = "ERR_NOT_EXPIRED";
pub const ERR_ALREADY_RECLAIMED: &str = "ERR_ALREADY_RECLAIMED";
pub const ERR_INSUFFICIENT_LONGS: &str = "ERR_INSUFFICIENT_LONGS";
pub const ERR_INSUFFICIENT_PAYMENT: &str = "ERR_INSUFFICIENT_PAYMENT";
pub const ERR_OFFER_AMOUNT: &str = "ERR_OFFER_AMOUNT";
pub const ERR_NOTHING_TO_PAY: &str = "ERR_NOTHING_TO_PAY";
pub const ERR_NOT_OWNER: &str = "ERR_NOT_OWNER";
pub const ERR_OVERFLOW: &str = "ERR_OVERFLOW";
// NEP-245 surface of the position token.
pub const ERR_APPROVALS_NOT_SUPPORTED: &str = "ERR_APPROVALS_NOT_SUPPORTED";
pub const ERR_SELF_TRANSFER: &str = "ERR_SELF_TRANSFER";
pub const ERR_LENGTH_MISMATCH: &str = "ERR_LENGTH_MISMATCH";

/// Expiry must lie in [now + 60 s, now + 366 days].
pub const MIN_EXPIRY_NS: u64 = 60 * 1_000_000_000;
pub const MAX_EXPIRY_NS: u64 = 366 * 24 * 60 * 60 * 1_000_000_000;

#[near(serializers = [json, borsh])]
#[serde(rename_all = "snake_case")]
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OptionKind {
    Call,
    Put,
}

/// One writer, immutable terms, fully collateralized (docs/SPEC.md, "Model").
#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct Series {
    pub writer: AccountId,
    pub kind: OptionKind,
    pub underlying: String,
    pub quote: String,
    pub underlying_per_option: u128,
    pub strike_per_option: u128,
    pub expiry_ns: u64,
    pub long_supply: u128,
    pub collateral_held: u128,
    pub proceeds_held: u128,
    pub exercised: u128,
    pub reclaimed: bool,
}

impl Series {
    pub fn collateral_token(&self) -> &str {
        match self.kind {
            OptionKind::Call => &self.underlying,
            OptionKind::Put => &self.quote,
        }
    }

    /// Also the amount delivered per exercised option.
    pub fn collateral_per_option(&self) -> u128 {
        match self.kind {
            OptionKind::Call => self.underlying_per_option,
            OptionKind::Put => self.strike_per_option,
        }
    }

    pub fn payment_token(&self) -> &str {
        match self.kind {
            OptionKind::Call => &self.quote,
            OptionKind::Put => &self.underlying,
        }
    }

    pub fn payment_per_option(&self) -> u128 {
        match self.kind {
            OptionKind::Call => self.strike_per_option,
            OptionKind::Put => self.underlying_per_option,
        }
    }

    pub fn is_expired(&self, now_ns: u64) -> bool {
        now_ns >= self.expiry_ns
    }
}

/// A fixed-price sale of longs held in escrow by the contract.
#[near(serializers = [borsh])]
#[derive(Clone, Debug)]
pub struct Offer {
    pub series_id: SeriesId,
    pub seller: AccountId,
    pub remaining: u128,
    pub price_per_option: u128,
}

/// The `msg` of an `intents.mt_transfer_call` to this contract (docs/SPEC.md, "Actions through Intents").
#[near(serializers = [json])]
#[serde(tag = "action", rename_all = "snake_case")]
#[derive(Clone, Debug)]
pub enum Action {
    Create {
        kind: OptionKind,
        underlying: String,
        quote: String,
        underlying_per_option: U128,
        strike_per_option: U128,
        expiry_ns: U64,
    },
    Write {
        series_id: U64,
    },
    Buy {
        offer_id: U64,
        amount: U128,
    },
    Exercise {
        series_id: U64,
        amount: U128,
        #[serde(default)]
        receiver_id: Option<AccountId>,
    },
}

/// The `msg` of `on_auth`: a direct method, run for the signer of an `auth_call` intent
/// (docs/SPEC.md, "Signed actions").
#[near(serializers = [json])]
#[serde(tag = "action", rename_all = "snake_case")]
#[derive(Clone, Debug)]
pub enum AuthAction {
    List {
        series_id: U64,
        amount: U128,
        price_per_option: U128,
    },
    CancelOffer {
        offer_id: U64,
    },
    Close {
        series_id: U64,
        amount: U128,
    },
    WithdrawProceeds {
        series_id: U64,
    },
    ReclaimCollateral {
        series_id: U64,
    },
    RetryPayout {
        token_id: String,
    },
    MtTransferCall {
        receiver_id: AccountId,
        token_id: String,
        amount: U128,
        #[serde(default)]
        memo: Option<String>,
        #[serde(default)]
        msg: String,
    },
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SeriesView {
    pub series_id: U64,
    pub token_id: String,
    pub writer: AccountId,
    pub kind: OptionKind,
    pub underlying: String,
    pub quote: String,
    pub underlying_per_option: U128,
    pub strike_per_option: U128,
    pub expiry_ns: U64,
    pub collateral_token: String,
    pub collateral_per_option: U128,
    pub payment_token: String,
    pub payment_per_option: U128,
    pub long_supply: U128,
    pub collateral_held: U128,
    pub proceeds_held: U128,
    pub exercised: U128,
    pub reclaimed: bool,
    pub expired: bool,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct OfferView {
    pub offer_id: U64,
    pub series_id: U64,
    pub seller: AccountId,
    pub remaining: U128,
    pub price_per_option: U128,
    pub price_token: String,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct AllowedToken {
    pub token_id: String,
    pub min_amount: U128,
}

#[near(serializers = [json])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ConfigView {
    pub owner_id: AccountId,
    pub intents_id: AccountId,
    pub allowed_tokens: Vec<AllowedToken>,
}
