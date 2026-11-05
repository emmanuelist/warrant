//! Signed actions (docs/SPEC.md, "Signed actions"; D-030). A wallet without a NEAR account signs
//! an `auth_call` intent; `intents.near` verifies the signature and calls `on_auth` with the
//! signer's account. Each action runs the direct method of the same name with `signer_id` as the
//! caller, so every refusal of that method holds here too.

use near_sdk::{AccountId, PromiseOrValue, env, near, require, serde_json};

use crate::{AuthAction, Contract, ContractExt, ERR_BAD_MSG, ERR_NOT_INTENTS};

#[near]
impl Contract {
    /// Called by Intents for an `auth_call` intent signed by `signer_id`. Intents verified the
    /// signature, so the caller check is the authorization; no yoctoNEAR is needed.
    #[payable]
    pub fn on_auth(&mut self, signer_id: AccountId, msg: String) -> PromiseOrValue<()> {
        require!(
            env::predecessor_account_id() == self.intents_id,
            ERR_NOT_INTENTS
        );
        let action: AuthAction =
            serde_json::from_str(&msg).unwrap_or_else(|_| env::panic_str(ERR_BAD_MSG));
        match action {
            AuthAction::List {
                series_id,
                amount,
                price_per_option,
            } => {
                self.list_for(signer_id, series_id, amount, price_per_option);
                PromiseOrValue::Value(())
            }
            AuthAction::CancelOffer { offer_id } => {
                self.cancel_offer_for(&signer_id, offer_id);
                PromiseOrValue::Value(())
            }
            AuthAction::Close { series_id, amount } => {
                self.close_for(signer_id, series_id, amount).into()
            }
            AuthAction::WithdrawProceeds { series_id } => {
                self.withdraw_proceeds_for(signer_id, series_id).into()
            }
            AuthAction::ReclaimCollateral { series_id } => self
                .reclaim_collateral_for(signer_id, series_id)
                .map_or(PromiseOrValue::Value(()), PromiseOrValue::Promise),
            AuthAction::RetryPayout { token_id } => {
                self.retry_payout_for(signer_id, token_id).into()
            }
            AuthAction::MtTransferCall {
                receiver_id,
                token_id,
                amount,
                memo,
                msg,
            } => match self.transfer_call_for(
                signer_id,
                receiver_id,
                vec![token_id],
                vec![amount],
                memo,
                msg,
            ) {
                PromiseOrValue::Promise(promise) => PromiseOrValue::Promise(promise),
                PromiseOrValue::Value(_) => PromiseOrValue::Value(()),
            },
        }
    }
}
