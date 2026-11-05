//! Longs as NEP-245 tokens (token_id = series ID). Holders can deposit them into Intents with
//! `mt_transfer_call(receiver_id = intents)`; Intents withdraws them back with `mt_batch_transfer`.

use std::borrow::Cow;

use defuse_nep245::receiver::ext_mt_receiver;
use defuse_nep245::resolver::{ClearedApproval, MultiTokenResolver};
use defuse_nep245::{
    MtBurnEvent, MtEvent, MtMintEvent, MtTransferEvent, MultiTokenCore, Token, TokenId,
};
use near_sdk::json_types::U128;
use near_sdk::{AccountId, Gas, PromiseOrValue, assert_one_yocto, env, near, require, serde_json};

use crate::{
    Contract, ContractExt, ERR_APPROVALS_NOT_SUPPORTED, ERR_INSUFFICIENT_LONGS,
    ERR_LENGTH_MISMATCH, ERR_SELF_TRANSFER, ERR_UNKNOWN_SERIES, ERR_ZERO, SeriesId, checked_add,
};

const GAS_FOR_MT_ON_TRANSFER: Gas = Gas::from_tgas(30);
const GAS_FOR_MT_RESOLVE_TRANSFER: Gas = Gas::from_tgas(15);
/// Upper bound on the receiver's refund list we are willing to read.
const MAX_RESOLVE_RESULT_LEN: usize = 4096;

impl Contract {
    pub(crate) fn balance_of(&self, series_id: SeriesId, account_id: &AccountId) -> u128 {
        self.balances
            .get(&(series_id, account_id.clone()))
            .copied()
            .unwrap_or(0)
    }

    fn set_balance(&mut self, series_id: SeriesId, account_id: &AccountId, amount: u128) {
        let key = (series_id, account_id.clone());
        if amount == 0 {
            self.balances.remove(&key);
        } else {
            self.balances.insert(key, amount);
        }
    }

    fn debit(&mut self, series_id: SeriesId, account_id: &AccountId, amount: u128) {
        let balance = self.balance_of(series_id, account_id);
        require!(balance >= amount, ERR_INSUFFICIENT_LONGS);
        self.set_balance(series_id, account_id, balance - amount);
    }

    fn credit(&mut self, series_id: SeriesId, account_id: &AccountId, amount: u128) {
        let balance = self.balance_of(series_id, account_id);
        self.set_balance(series_id, account_id, checked_add(balance, amount));
    }

    /// Mints longs. The caller keeps `Series::long_supply` in step.
    pub(crate) fn mint_longs(
        &mut self,
        series_id: SeriesId,
        owner: &AccountId,
        amount: u128,
        memo: &str,
    ) {
        self.credit(series_id, owner, amount);
        MtEvent::MtMint(Cow::Owned(vec![MtMintEvent {
            owner_id: Cow::Borrowed(owner.as_ref()),
            token_ids: Cow::Owned(vec![series_id.to_string()]),
            amounts: Cow::Owned(vec![amount]),
            memo: Some(Cow::Borrowed(memo)),
        }]))
        .emit();
    }

    /// Burns longs. The caller keeps `Series::long_supply` in step.
    pub(crate) fn burn_longs(
        &mut self,
        series_id: SeriesId,
        owner: &AccountId,
        amount: u128,
        memo: &str,
    ) {
        self.debit(series_id, owner, amount);
        MtEvent::MtBurn(Cow::Owned(vec![MtBurnEvent {
            owner_id: Cow::Borrowed(owner.as_ref()),
            authorized_id: None,
            token_ids: Cow::Owned(vec![series_id.to_string()]),
            amounts: Cow::Owned(vec![amount]),
            memo: Some(Cow::Borrowed(memo)),
        }]))
        .emit();
    }

    /// Moves longs between holders (escrow, purchases, refunds). Supply is unchanged.
    pub(crate) fn move_longs(
        &mut self,
        series_id: SeriesId,
        from: &AccountId,
        to: &AccountId,
        amount: u128,
        memo: &str,
    ) {
        self.debit(series_id, from, amount);
        self.credit(series_id, to, amount);
        MtEvent::MtTransfer(Cow::Owned(vec![MtTransferEvent {
            authorized_id: None,
            old_owner_id: Cow::Borrowed(from.as_ref()),
            new_owner_id: Cow::Borrowed(to.as_ref()),
            token_ids: Cow::Owned(vec![series_id.to_string()]),
            amounts: Cow::Owned(vec![amount]),
            memo: Some(Cow::Borrowed(memo)),
        }]))
        .emit();
    }

    /// `Some(id)` when `token_id` names an existing series.
    fn known_series(&self, token_id: &str) -> Option<SeriesId> {
        token_id
            .parse::<SeriesId>()
            .ok()
            .filter(|id| self.series.contains_key(id))
    }

    fn series_of_token(&self, token_id: &str) -> SeriesId {
        self.known_series(token_id)
            .unwrap_or_else(|| env::panic_str(ERR_UNKNOWN_SERIES))
    }

    fn batch_transfer(
        &mut self,
        sender_id: &AccountId,
        receiver_id: &AccountId,
        token_ids: &[TokenId],
        amounts: &[U128],
        memo: Option<&str>,
    ) {
        require!(sender_id != receiver_id, ERR_SELF_TRANSFER);
        require!(
            !token_ids.is_empty() && token_ids.len() == amounts.len(),
            ERR_LENGTH_MISMATCH
        );
        for (token_id, amount) in token_ids.iter().zip(amounts) {
            require!(amount.0 > 0, ERR_ZERO);
            let series_id = self.series_of_token(token_id);
            self.debit(series_id, sender_id, amount.0);
            self.credit(series_id, receiver_id, amount.0);
        }
        MtEvent::MtTransfer(Cow::Owned(vec![MtTransferEvent {
            authorized_id: None,
            old_owner_id: Cow::Borrowed(sender_id.as_ref()),
            new_owner_id: Cow::Borrowed(receiver_id.as_ref()),
            token_ids: Cow::Borrowed(token_ids),
            amounts: Cow::Owned(amounts.iter().map(|a| a.0).collect()),
            memo: memo.map(Cow::Borrowed),
        }]))
        .emit();
    }

    /// `mt_batch_transfer_call` for `sender_id`: moves the longs, then lets the receiver keep or
    /// return them.
    pub(crate) fn transfer_call_for(
        &mut self,
        sender_id: AccountId,
        receiver_id: AccountId,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<Vec<U128>> {
        self.batch_transfer(
            &sender_id,
            &receiver_id,
            &token_ids,
            &amounts,
            memo.as_deref(),
        );

        let previous_owner_ids = vec![sender_id.clone(); token_ids.len()];
        ext_mt_receiver::ext(receiver_id.clone())
            .with_static_gas(GAS_FOR_MT_ON_TRANSFER)
            .with_unused_gas_weight(1)
            .mt_on_transfer(
                sender_id,
                previous_owner_ids.clone(),
                token_ids.clone(),
                amounts.clone(),
                msg,
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_MT_RESOLVE_TRANSFER)
                    .with_unused_gas_weight(0)
                    .mt_resolve_transfer(previous_owner_ids, receiver_id, token_ids, amounts, None),
            )
            .into()
    }
}

#[near]
impl MultiTokenCore for Contract {
    #[payable]
    fn mt_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        amount: U128,
        approval: Option<(AccountId, u64)>,
        memo: Option<String>,
    ) {
        assert_one_yocto();
        require!(approval.is_none(), ERR_APPROVALS_NOT_SUPPORTED);
        let sender_id = env::predecessor_account_id();
        self.batch_transfer(
            &sender_id,
            &receiver_id,
            &[token_id],
            &[amount],
            memo.as_deref(),
        );
    }

    #[payable]
    fn mt_batch_transfer(
        &mut self,
        receiver_id: AccountId,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
        approvals: Option<Vec<Option<(AccountId, u64)>>>,
        memo: Option<String>,
    ) {
        assert_one_yocto();
        require!(approvals.is_none(), ERR_APPROVALS_NOT_SUPPORTED);
        let sender_id = env::predecessor_account_id();
        self.batch_transfer(
            &sender_id,
            &receiver_id,
            &token_ids,
            &amounts,
            memo.as_deref(),
        );
    }

    #[payable]
    fn mt_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_id: TokenId,
        amount: U128,
        approval: Option<(AccountId, u64)>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<Vec<U128>> {
        self.mt_batch_transfer_call(
            receiver_id,
            vec![token_id],
            vec![amount],
            approval.map(|a| vec![Some(a)]),
            memo,
            msg,
        )
    }

    #[payable]
    fn mt_batch_transfer_call(
        &mut self,
        receiver_id: AccountId,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
        approvals: Option<Vec<Option<(AccountId, u64)>>>,
        memo: Option<String>,
        msg: String,
    ) -> PromiseOrValue<Vec<U128>> {
        assert_one_yocto();
        require!(approvals.is_none(), ERR_APPROVALS_NOT_SUPPORTED);
        self.transfer_call_for(
            env::predecessor_account_id(),
            receiver_id,
            token_ids,
            amounts,
            memo,
            msg,
        )
    }

    fn mt_token(&self, token_ids: Vec<TokenId>) -> Vec<Option<Token>> {
        token_ids
            .into_iter()
            .map(|token_id| {
                self.known_series(&token_id).map(|_| Token {
                    token_id,
                    owner_id: None,
                })
            })
            .collect()
    }

    fn mt_balance_of(&self, account_id: AccountId, token_id: TokenId) -> U128 {
        U128(
            self.known_series(&token_id)
                .map_or(0, |id| self.balance_of(id, &account_id)),
        )
    }

    fn mt_batch_balance_of(&self, account_id: AccountId, token_ids: Vec<TokenId>) -> Vec<U128> {
        token_ids
            .into_iter()
            .map(|token_id| self.mt_balance_of(account_id.clone(), token_id))
            .collect()
    }

    fn mt_supply(&self, token_id: TokenId) -> Option<U128> {
        self.known_series(&token_id)
            .and_then(|id| self.series.get(&id))
            .map(|series| U128(series.long_supply))
    }

    fn mt_batch_supply(&self, token_ids: Vec<TokenId>) -> Vec<Option<U128>> {
        token_ids
            .into_iter()
            .map(|token_id| self.mt_supply(token_id))
            .collect()
    }
}

#[near]
impl MultiTokenResolver for Contract {
    /// Returns the amounts the receiver kept. Refunds what it returned, capped by what it still
    /// holds; a failed or malformed receiver call refunds everything it still holds.
    fn mt_resolve_transfer(
        &mut self,
        previous_owner_ids: Vec<AccountId>,
        receiver_id: AccountId,
        token_ids: Vec<TokenId>,
        amounts: Vec<U128>,
        approvals: Option<Vec<Option<Vec<ClearedApproval>>>>,
    ) -> Vec<U128> {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "ERR_PRIVATE"
        );
        let _ = approvals;
        let requested: Vec<U128> = env::promise_result_checked(0, MAX_RESOLVE_RESULT_LEN)
            .ok()
            .and_then(|bytes| serde_json::from_slice::<Vec<U128>>(&bytes).ok())
            .filter(|refunds| refunds.len() == amounts.len())
            .unwrap_or_else(|| amounts.clone());

        let mut kept = Vec::with_capacity(amounts.len());
        for ((token_id, previous_owner_id), (amount, refund)) in token_ids
            .iter()
            .zip(&previous_owner_ids)
            .zip(amounts.iter().zip(&requested))
        {
            let series_id = self.series_of_token(token_id);
            let refund = refund
                .0
                .min(amount.0)
                .min(self.balance_of(series_id, &receiver_id));
            if refund > 0 {
                self.move_longs(series_id, &receiver_id, previous_owner_id, refund, "refund");
            }
            kept.push(U128(amount.0 - refund));
        }
        kept
    }
}
