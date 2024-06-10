use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
#[derive(InitSpace)]
pub struct AuthorizedClmmPool {
    pub pool_state: Pubkey,
    pub program_id: Pubkey,
    pub mint: Pubkey,
    pub donation_protocol: Pubkey,
}
