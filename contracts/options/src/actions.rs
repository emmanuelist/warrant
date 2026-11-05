//! Writes, purchases and exercises arrive as `intents.mt_transfer_call` to this contract
//! (docs/SPEC.md, "Actions through Intents"). The tokens are already in this contract's Intents
//! balance; we return the amount to refund, and a panic makes Intents refund everything.

use defuse_nep245::TokenId;
use defuse_nep245::receiver::MultiTokenReceiver;
use near_sdk::json_types::{U64, U128};
use near_sdk::{AccountId, PromiseOrValue, env, near, require, serde_json};

use crate::{
    Action, Contract, ContractExt, ERR_BAD_EXPIRY, ERR_BAD_MSG, ERR_BATCH_NOT_SUPPORTED,
    ERR_BELOW_MIN, ERR_EXPIRED, ERR_INSUFFICIENT_LONGS, ERR_INSUFFICIENT_PAYMENT, ERR_NOT_INTENTS,
    ERR_NOT_WRITER, ERR_OFFER_AMOUNT, ERR_SAME_TOKEN, ERR_TOKEN_NOT_ALLOWED, ERR_UNKNOWN_OFFER,
    ERR_WRONG_TOKEN, ERR_ZERO, MAX_EXPIRY_NS, MIN_EXPIRY_NS, OfferId, OptionKind, OptionsEvent,
    Series, SeriesId, checked_add, checked_mul,
};

#[near]
impl MultiTokenReceiver for Contract {
    fn mt_on_transfer(
        &mut self,
        sender_id: AccountId,
        previous_owner_ids: Vec<AccountId>,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
        msg: String,
    ) -> PromiseOrValue<Vec<U128>> {
        require!(
            env::predecessor_account_id() == self.intents_id,
            ERR_NOT_INTENTS
        );
        require!(
            token_ids.len() == 1 && amounts.len() == 1 && previous_owner_ids.len() == 1,
            ERR_BATCH_NOT_SUPPORTED
        );
        let action: Action =
            serde_json::from_str(&msg).unwrap_or_else(|_| env::panic_str(ERR_BAD_MSG));
        let token_id = token_ids[0].as_str();
        let amount = amounts[0].0;
        require!(amount > 0, ERR_ZERO);

        let refund = match action {
            Action::Create {
                kind,
                underlying,
                quote,
                underlying_per_option,
                strike_per_option,
                expiry_ns,
            } => self.on_create(
                &sender_id,
                token_id,
                amount,
                Series {
                    writer: sender_id.clone(),
                    kind,
                    underlying,
                    quote,
                    underlying_per_option: underlying_per_option.0,
                    strike_per_option: strike_per_option.0,
                    expiry_ns: expiry_ns.0,
                    long_supply: 0,
                    collateral_held: 0,
                    proceeds_held: 0,
                    exercised: 0,
                    reclaimed: false,
                },
            ),
            Action::Write { series_id } => self.on_write(&sender_id, token_id, amount, series_id.0),
            Action::Buy {
                offer_id,
                amount: options,
            } => self.on_buy(&sender_id, token_id, amount, offer_id.0, options.0),
            Action::Exercise {
                series_id,
                amount: options,
                receiver_id,
            } => self.on_exercise(
                &sender_id,
                token_id,
                amount,
                series_id.0,
                options.0,
                receiver_id.unwrap_or_else(|| sender_id.clone()),
            ),
        };
        PromiseOrValue::Value(vec![U128(refund)])
    }
}

impl Contract {
    fn on_create(
        &mut self,
        writer: &AccountId,
        token_id: &str,
        amount: u128,
        mut series: Series,
    ) -> u128 {
        require!(series.underlying != series.quote, ERR_SAME_TOKEN);
        require!(
            series.underlying_per_option > 0 && series.strike_per_option > 0,
            ERR_ZERO
        );
        let min_underlying = self.min_amount_of(&series.underlying);
        let min_quote = self.min_amount_of(&series.quote);
        let now = env::block_timestamp();
        require!(
            series.expiry_ns >= now.saturating_add(MIN_EXPIRY_NS)
                && series.expiry_ns <= now.saturating_add(MAX_EXPIRY_NS),
            ERR_BAD_EXPIRY
        );
        require!(token_id == series.collateral_token(), ERR_WRONG_TOKEN);
        let min_amount = match series.kind {
            OptionKind::Call => min_underlying,
            OptionKind::Put => min_quote,
        };
        require!(amount >= min_amount, ERR_BELOW_MIN);

        let per_option = series.collateral_per_option();
        let options = amount / per_option;
        require!(options > 0, ERR_ZERO);
        let locked = options * per_option;
        series.long_supply = options;
        series.collateral_held = locked;

        let series_id = self.next_series_id;
        self.next_series_id += 1;
        OptionsEvent::Create {
            series_id: U64(series_id),
            writer: writer.clone(),
            kind: series.kind,
            underlying: series.underlying.clone(),
            quote: series.quote.clone(),
            underlying_per_option: U128(series.underlying_per_option),
            strike_per_option: U128(series.strike_per_option),
            expiry_ns: U64(series.expiry_ns),
            amount: U128(options),
        }
        .emit();
        self.series.insert(series_id, series);
        self.mint_longs(series_id, writer, options, "create");
        amount - locked
    }

    fn on_write(
        &mut self,
        writer: &AccountId,
        token_id: &str,
        amount: u128,
        series_id: SeriesId,
    ) -> u128 {
        let series = self.series_or_panic(series_id);
        require!(&series.writer == writer, ERR_NOT_WRITER);
        require!(!series.is_expired(env::block_timestamp()), ERR_EXPIRED);
        require!(token_id == series.collateral_token(), ERR_WRONG_TOKEN);
        let per_option = series.collateral_per_option();
        let options = amount / per_option;
        require!(options > 0, ERR_ZERO);
        let locked = options * per_option;

        let series = self.series_mut_or_panic(series_id);
        series.long_supply = checked_add(series.long_supply, options);
        series.collateral_held = checked_add(series.collateral_held, locked);
        self.mint_longs(series_id, writer, options, "write");
        OptionsEvent::Write {
            series_id: U64(series_id),
            writer: writer.clone(),
            amount: U128(options),
        }
        .emit();
        amount - locked
    }

    fn on_buy(
        &mut self,
        buyer: &AccountId,
        token_id: &str,
        paid: u128,
        offer_id: OfferId,
        options: u128,
    ) -> u128 {
        let offer = self
            .offers
            .get(&offer_id)
            .cloned()
            .unwrap_or_else(|| env::panic_str(ERR_UNKNOWN_OFFER));
        let series = self.series_or_panic(offer.series_id);
        require!(!series.is_expired(env::block_timestamp()), ERR_EXPIRED);
        require!(token_id == series.quote, ERR_WRONG_TOKEN);
        require!(options > 0, ERR_ZERO);
        require!(options <= offer.remaining, ERR_OFFER_AMOUNT);
        let premium = checked_mul(offer.price_per_option, options);
        require!(paid >= premium, ERR_INSUFFICIENT_PAYMENT);
        let quote = series.quote.clone();

        let escrow = env::current_account_id();
        self.move_longs(offer.series_id, &escrow, buyer, options, "buy");
        if options == offer.remaining {
            self.offers.remove(&offer_id);
        } else if let Some(stored) = self.offers.get_mut(&offer_id) {
            stored.remaining -= options;
        }
        OptionsEvent::Buy {
            offer_id: U64(offer_id),
            series_id: U64(offer.series_id),
            buyer: buyer.clone(),
            seller: offer.seller.clone(),
            amount: U128(options),
            premium: U128(premium),
        }
        .emit();
        self.pay(offer.seller, quote, premium).detach();
        paid - premium
    }

    fn on_exercise(
        &mut self,
        holder: &AccountId,
        token_id: &str,
        paid: u128,
        series_id: SeriesId,
        options: u128,
        receiver_id: AccountId,
    ) -> u128 {
        let series = self.series_or_panic(series_id);
        require!(!series.is_expired(env::block_timestamp()), ERR_EXPIRED);
        require!(token_id == series.payment_token(), ERR_WRONG_TOKEN);
        require!(options > 0, ERR_ZERO);
        require!(
            self.balance_of(series_id, holder) >= options,
            ERR_INSUFFICIENT_LONGS
        );
        let cost = checked_mul(series.payment_per_option(), options);
        require!(paid >= cost, ERR_INSUFFICIENT_PAYMENT);
        let delivered = checked_mul(series.collateral_per_option(), options);
        let collateral_token = series.collateral_token().to_string();

        self.burn_longs(series_id, holder, options, "exercise");
        let series = self.series_mut_or_panic(series_id);
        series.long_supply -= options;
        series.collateral_held -= delivered;
        series.proceeds_held = checked_add(series.proceeds_held, cost);
        series.exercised = checked_add(series.exercised, options);
        OptionsEvent::Exercise {
            series_id: U64(series_id),
            holder: holder.clone(),
            receiver_id: receiver_id.clone(),
            amount: U128(options),
            paid: U128(cost),
            delivered: U128(delivered),
        }
        .emit();
        self.pay(receiver_id, collateral_token, delivered).detach();
        paid - cost
    }

    fn min_amount_of(&self, token_id: &str) -> u128 {
        self.allowed
            .get(token_id)
            .copied()
            .unwrap_or_else(|| env::panic_str(ERR_TOKEN_NOT_ALLOWED))
    }
}
