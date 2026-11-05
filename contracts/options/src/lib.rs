//! Fully collateralized, physically settled options whose collateral, premiums and payouts live
//! inside NEAR Intents. Behavior is specified in docs/SPEC.md; design decisions in docs/DECISIONS.md.

use near_sdk::json_types::{U64, U128};
use near_sdk::store::{IterableMap, LookupMap};
use near_sdk::{AccountId, BorshStorageKey, PanicOnDefault, assert_one_yocto, env, near, require};

mod actions;
mod auth;
mod events;
mod market;
mod payouts;
mod positions;
#[cfg(test)]
mod tests;
mod types;

pub use events::OptionsEvent;
pub use types::*;

const DEFAULT_PAGE: u64 = 50;
const MAX_PAGE: u64 = 100;

#[near(serializers = [borsh])]
#[derive(BorshStorageKey)]
enum StorageKey {
    Allowed,
    Series,
    Offers,
    Balances,
    Owed,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Contract {
    owner_id: AccountId,
    intents_id: AccountId,
    /// Allowlisted Intents token IDs and the minimum collateral for `create`.
    allowed: IterableMap<String, u128>,
    series: IterableMap<SeriesId, Series>,
    next_series_id: SeriesId,
    offers: IterableMap<OfferId, Offer>,
    next_offer_id: OfferId,
    /// NEP-245 ledger of longs: (series, holder) -> amount.
    balances: LookupMap<(SeriesId, AccountId), u128>,
    /// Payouts whose `mt_transfer` failed, claimable with `retry_payout`.
    owed: LookupMap<(AccountId, String), u128>,
}

#[near]
impl Contract {
    #[init]
    pub fn new(owner_id: AccountId, intents_id: AccountId) -> Self {
        Self {
            owner_id,
            intents_id,
            allowed: IterableMap::new(StorageKey::Allowed),
            series: IterableMap::new(StorageKey::Series),
            next_series_id: 1,
            offers: IterableMap::new(StorageKey::Offers),
            next_offer_id: 1,
            balances: LookupMap::new(StorageKey::Balances),
            owed: LookupMap::new(StorageKey::Owed),
        }
    }

    /// Owner: allow `token_id` as an underlying or quote, with a minimum collateral per `create`.
    #[payable]
    pub fn allow_token(&mut self, token_id: String, min_amount: U128) {
        assert_one_yocto();
        self.assert_owner();
        require!(min_amount.0 > 0, ERR_ZERO);
        self.allowed.insert(token_id, min_amount.0);
    }

    /// Owner: stop new series using `token_id`. Existing series are unaffected.
    #[payable]
    pub fn disallow_token(&mut self, token_id: String) {
        assert_one_yocto();
        self.assert_owner();
        self.allowed.remove(&token_id);
    }

    pub fn get_config(&self) -> ConfigView {
        ConfigView {
            owner_id: self.owner_id.clone(),
            intents_id: self.intents_id.clone(),
            allowed_tokens: self
                .allowed
                .iter()
                .map(|(token_id, min)| AllowedToken {
                    token_id: token_id.clone(),
                    min_amount: U128(*min),
                })
                .collect(),
        }
    }

    pub fn get_series(&self, series_id: U64) -> Option<SeriesView> {
        self.series
            .get(&series_id.0)
            .map(|series| self.series_view(series_id.0, series))
    }

    pub fn get_series_list(&self, from_index: Option<U64>, limit: Option<U64>) -> Vec<SeriesView> {
        let (skip, take) = page(from_index, limit);
        self.series
            .iter()
            .skip(skip)
            .take(take)
            .map(|(id, series)| self.series_view(*id, series))
            .collect()
    }

    pub fn get_offer(&self, offer_id: U64) -> Option<OfferView> {
        self.offers
            .get(&offer_id.0)
            .map(|offer| self.offer_view(offer_id.0, offer))
    }

    pub fn get_offers(&self, from_index: Option<U64>, limit: Option<U64>) -> Vec<OfferView> {
        let (skip, take) = page(from_index, limit);
        self.offers
            .iter()
            .skip(skip)
            .take(take)
            .map(|(id, offer)| self.offer_view(*id, offer))
            .collect()
    }

    pub fn get_owed(&self, account_id: AccountId, token_id: String) -> U128 {
        U128(self.owed.get(&(account_id, token_id)).copied().unwrap_or(0))
    }
}

impl Contract {
    fn assert_owner(&self) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            ERR_NOT_OWNER
        );
    }

    pub(crate) fn series_or_panic(&self, series_id: SeriesId) -> &Series {
        self.series
            .get(&series_id)
            .unwrap_or_else(|| env::panic_str(ERR_UNKNOWN_SERIES))
    }

    pub(crate) fn series_mut_or_panic(&mut self, series_id: SeriesId) -> &mut Series {
        self.series
            .get_mut(&series_id)
            .unwrap_or_else(|| env::panic_str(ERR_UNKNOWN_SERIES))
    }

    fn series_view(&self, series_id: SeriesId, series: &Series) -> SeriesView {
        SeriesView {
            series_id: U64(series_id),
            token_id: series_id.to_string(),
            writer: series.writer.clone(),
            kind: series.kind,
            underlying: series.underlying.clone(),
            quote: series.quote.clone(),
            underlying_per_option: U128(series.underlying_per_option),
            strike_per_option: U128(series.strike_per_option),
            expiry_ns: U64(series.expiry_ns),
            collateral_token: series.collateral_token().to_string(),
            collateral_per_option: U128(series.collateral_per_option()),
            payment_token: series.payment_token().to_string(),
            payment_per_option: U128(series.payment_per_option()),
            long_supply: U128(series.long_supply),
            collateral_held: U128(series.collateral_held),
            proceeds_held: U128(series.proceeds_held),
            exercised: U128(series.exercised),
            reclaimed: series.reclaimed,
            expired: series.is_expired(env::block_timestamp()),
        }
    }

    fn offer_view(&self, offer_id: OfferId, offer: &Offer) -> OfferView {
        OfferView {
            offer_id: U64(offer_id),
            series_id: U64(offer.series_id),
            seller: offer.seller.clone(),
            remaining: U128(offer.remaining),
            price_per_option: U128(offer.price_per_option),
            price_token: self.series_or_panic(offer.series_id).quote.clone(),
        }
    }
}

pub(crate) fn checked_mul(a: u128, b: u128) -> u128 {
    a.checked_mul(b)
        .unwrap_or_else(|| env::panic_str(ERR_OVERFLOW))
}

pub(crate) fn checked_add(a: u128, b: u128) -> u128 {
    a.checked_add(b)
        .unwrap_or_else(|| env::panic_str(ERR_OVERFLOW))
}

fn page(from_index: Option<U64>, limit: Option<U64>) -> (usize, usize) {
    let skip = from_index.map_or(0, |v| v.0);
    let take = limit.map_or(DEFAULT_PAGE, |v| v.0).min(MAX_PAGE);
    (
        usize::try_from(skip).unwrap_or(usize::MAX),
        usize::try_from(take).unwrap_or(0),
    )
}
