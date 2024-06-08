use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
#[derive(InitSpace)]
pub struct AuthorizedPool {
    pub pool_state: Pubkey,
    pub program_id: Pubkey,
    pub token: Pubkey,
    pub donation_protocol: Pubkey,
}
