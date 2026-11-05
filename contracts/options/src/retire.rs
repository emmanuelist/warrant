//! The one way this contract ever goes away (docs/SPEC.md, "Retiring", D-038).
//!
//! With its keys deleted, nobody can change this code, and its storage deposit would be stuck
//! forever. `retire` returns that deposit, and only when doing so can't cost anyone anything: it
//! moves no tokens, and it refuses while the contract holds a single unit for anyone.

use near_sdk::{Promise, assert_one_yocto, env, near, require};

use crate::{Contract, ContractExt, ERR_CANNOT_RETIRE, OptionsEvent};

#[near]
impl Contract {
    /// Anyone, from `retire_after_ns`, once every series has paid out its collateral and proceeds
    /// and no payout is owed or in flight. Deletes this account, which sends its NEAR to the owner.
    #[payable]
    pub fn retire(&mut self) -> Promise {
        assert_one_yocto();
        require!(
            env::block_timestamp() >= self.retire_after_ns,
            ERR_CANNOT_RETIRE
        );
        require!(
            self.owed_entries == 0 && self.payouts_in_flight == 0,
            ERR_CANNOT_RETIRE
        );
        require!(
            self.series
                .values()
                .all(|series| series.collateral_held == 0 && series.proceeds_held == 0),
            ERR_CANNOT_RETIRE
        );
        // The chain refuses to delete an account holding more than 10 KB of state (docs/CONTEXT.md).
        self.series.clear();
        self.offers.clear();
        self.allowed.clear();
        OptionsEvent::Retired {
            beneficiary: self.owner_id.clone(),
        }
        .emit();
        Promise::new(env::current_account_id()).delete_account(self.owner_id.clone())
    }
}
