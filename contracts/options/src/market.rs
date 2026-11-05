//! Direct methods: offers, early close by the writer, proceeds and collateral claims
//! (docs/SPEC.md, "Direct methods"). Each requires exactly 1 yoctoNEAR. `on_auth` runs the same
//! code for the signer of an `auth_call` intent (src/auth.rs).

use near_sdk::json_types::{U64, U128};
use near_sdk::{AccountId, Promise, assert_one_yocto, env, near, require};

use crate::{
    Contract, ContractExt, ERR_ALREADY_RECLAIMED, ERR_EXPIRED, ERR_NOT_EXPIRED, ERR_NOT_SELLER,
    ERR_NOT_WRITER, ERR_NOTHING_TO_PAY, ERR_UNKNOWN_OFFER, ERR_ZERO, Offer, OptionsEvent,
};

#[near]
impl Contract {
    /// Escrows `amount` of the caller's longs in a fixed-price offer. Returns the offer ID.
    #[payable]
    pub fn list(&mut self, series_id: U64, amount: U128, price_per_option: U128) -> U64 {
        assert_one_yocto();
        self.list_for(
            env::predecessor_account_id(),
            series_id,
            amount,
            price_per_option,
        )
    }

    /// Returns the unsold longs of an offer to its seller.
    #[payable]
    pub fn cancel_offer(&mut self, offer_id: U64) {
        assert_one_yocto();
        self.cancel_offer_for(&env::predecessor_account_id(), offer_id);
    }

    /// Writer, before expiry: burns `amount` of their own longs and takes back the collateral.
    #[payable]
    pub fn close(&mut self, series_id: U64, amount: U128) -> Promise {
        assert_one_yocto();
        self.close_for(env::predecessor_account_id(), series_id, amount)
    }

    /// Writer, any time: takes the exercise payments received so far.
    #[payable]
    pub fn withdraw_proceeds(&mut self, series_id: U64) -> Promise {
        assert_one_yocto();
        self.withdraw_proceeds_for(env::predecessor_account_id(), series_id)
    }

    /// Writer, after expiry, once: takes back the collateral of unexercised options.
    #[payable]
    pub fn reclaim_collateral(&mut self, series_id: U64) -> Option<Promise> {
        assert_one_yocto();
        self.reclaim_collateral_for(env::predecessor_account_id(), series_id)
    }
}

impl Contract {
    pub(crate) fn list_for(
        &mut self,
        seller: AccountId,
        series_id: U64,
        amount: U128,
        price_per_option: U128,
    ) -> U64 {
        let series = self.series_or_panic(series_id.0);
        require!(!series.is_expired(env::block_timestamp()), ERR_EXPIRED);
        require!(amount.0 > 0 && price_per_option.0 > 0, ERR_ZERO);

        let escrow = env::current_account_id();
        self.move_longs(series_id.0, &seller, &escrow, amount.0, "list");
        let offer_id = self.next_offer_id;
        self.next_offer_id += 1;
        self.offers.insert(
            offer_id,
            Offer {
                series_id: series_id.0,
                seller: seller.clone(),
                remaining: amount.0,
                price_per_option: price_per_option.0,
            },
        );
        OptionsEvent::List {
            offer_id: U64(offer_id),
            series_id,
            seller,
            amount,
            price_per_option,
        }
        .emit();
        U64(offer_id)
    }

    pub(crate) fn cancel_offer_for(&mut self, caller: &AccountId, offer_id: U64) {
        let offer = self
            .offers
            .get(&offer_id.0)
            .cloned()
            .unwrap_or_else(|| env::panic_str(ERR_UNKNOWN_OFFER));
        require!(caller == &offer.seller, ERR_NOT_SELLER);
        self.offers.remove(&offer_id.0);
        let escrow = env::current_account_id();
        self.move_longs(
            offer.series_id,
            &escrow,
            &offer.seller,
            offer.remaining,
            "cancel_offer",
        );
        OptionsEvent::CancelOffer {
            offer_id,
            seller: offer.seller,
            returned: U128(offer.remaining),
        }
        .emit();
    }

    pub(crate) fn close_for(&mut self, writer: AccountId, series_id: U64, amount: U128) -> Promise {
        let series = self.series_or_panic(series_id.0);
        require!(series.writer == writer, ERR_NOT_WRITER);
        require!(!series.is_expired(env::block_timestamp()), ERR_EXPIRED);
        require!(amount.0 > 0, ERR_ZERO);
        let returned = crate::checked_mul(series.collateral_per_option(), amount.0);
        let collateral_token = series.collateral_token().to_string();

        self.burn_longs(series_id.0, &writer, amount.0, "close");
        let series = self.series_mut_or_panic(series_id.0);
        series.long_supply -= amount.0;
        series.collateral_held -= returned;
        OptionsEvent::Close {
            series_id,
            writer: writer.clone(),
            amount,
            returned: U128(returned),
        }
        .emit();
        self.pay(writer, collateral_token, returned)
    }

    pub(crate) fn withdraw_proceeds_for(&mut self, writer: AccountId, series_id: U64) -> Promise {
        let series = self.series_mut_or_panic(series_id.0);
        require!(series.writer == writer, ERR_NOT_WRITER);
        let amount = series.proceeds_held;
        require!(amount > 0, ERR_NOTHING_TO_PAY);
        series.proceeds_held = 0;
        let payment_token = series.payment_token().to_string();
        OptionsEvent::WithdrawProceeds {
            series_id,
            writer: writer.clone(),
            amount: U128(amount),
        }
        .emit();
        self.pay(writer, payment_token, amount)
    }

    pub(crate) fn reclaim_collateral_for(
        &mut self,
        writer: AccountId,
        series_id: U64,
    ) -> Option<Promise> {
        let now = env::block_timestamp();
        let series = self.series_mut_or_panic(series_id.0);
        require!(series.writer == writer, ERR_NOT_WRITER);
        require!(series.is_expired(now), ERR_NOT_EXPIRED);
        require!(!series.reclaimed, ERR_ALREADY_RECLAIMED);
        series.reclaimed = true;
        let amount = series.collateral_held;
        series.collateral_held = 0;
        let collateral_token = series.collateral_token().to_string();
        OptionsEvent::ReclaimCollateral {
            series_id,
            writer: writer.clone(),
            amount: U128(amount),
        }
        .emit();
        (amount > 0).then(|| self.pay(writer, collateral_token, amount))
    }
}
