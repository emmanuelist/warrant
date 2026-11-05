//! Every payout is `intents.mt_transfer` from this contract. A failed payout is credited to the
//! owed-ledger and can be re-sent with `retry_payout` (docs/SPEC.md, "Direct methods").

use defuse_nep245::ext_mt_core;
use near_sdk::json_types::U128;
use near_sdk::{
    AccountId, Gas, NearToken, Promise, PromiseError, assert_one_yocto, env, near, require,
};

use crate::{Contract, ContractExt, ERR_NOTHING_TO_PAY, OptionsEvent, checked_add};

const GAS_FOR_INTENTS_TRANSFER: Gas = Gas::from_tgas(15);
const GAS_FOR_ON_PAYOUT: Gas = Gas::from_tgas(5);
const PAYOUT_MEMO: &str = "intents-options payout";

impl Contract {
    pub(crate) fn pay(&self, receiver_id: AccountId, token_id: String, amount: u128) -> Promise {
        ext_mt_core::ext(self.intents_id.clone())
            .with_attached_deposit(NearToken::from_yoctonear(1))
            .with_static_gas(GAS_FOR_INTENTS_TRANSFER)
            .mt_transfer(
                receiver_id.clone(),
                token_id.clone(),
                U128(amount),
                None,
                Some(PAYOUT_MEMO.to_string()),
            )
            .then(
                Self::ext(env::current_account_id())
                    .with_static_gas(GAS_FOR_ON_PAYOUT)
                    .on_payout(receiver_id, token_id, U128(amount)),
            )
    }

    fn credit_owed(&mut self, receiver_id: AccountId, token_id: String, amount: u128) {
        let key = (receiver_id, token_id);
        let owed = self.owed.get(&key).copied().unwrap_or(0);
        self.owed.insert(key, checked_add(owed, amount));
    }
}

#[near]
impl Contract {
    /// Callback of `pay`. Only an explicit failure is credited as owed: a successful transfer
    /// whose result we can't read must not be paid twice.
    #[private]
    pub fn on_payout(&mut self, receiver_id: AccountId, token_id: String, amount: U128) {
        if let Err(PromiseError::Failed) = env::promise_result_checked(0, 0) {
            OptionsEvent::PayoutFailed {
                receiver_id: receiver_id.clone(),
                token_id: token_id.clone(),
                amount,
            }
            .emit();
            self.credit_owed(receiver_id, token_id, amount.0);
        }
    }

    /// Re-sends the caller's owed balance of `token_id`.
    #[payable]
    pub fn retry_payout(&mut self, token_id: String) -> Promise {
        assert_one_yocto();
        self.retry_payout_for(env::predecessor_account_id(), token_id)
    }
}

impl Contract {
    pub(crate) fn retry_payout_for(&mut self, receiver_id: AccountId, token_id: String) -> Promise {
        let amount = self
            .owed
            .remove(&(receiver_id.clone(), token_id.clone()))
            .unwrap_or(0);
        require!(amount > 0, ERR_NOTHING_TO_PAY);
        OptionsEvent::PayoutRetried {
            receiver_id: receiver_id.clone(),
            token_id: token_id.clone(),
            amount: U128(amount),
        }
        .emit();
        self.pay(receiver_id, token_id, amount)
    }
}
