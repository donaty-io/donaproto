use anchor_lang::prelude::*;

#[account]
#[derive(Default)]
#[derive(InitSpace)]
pub struct AuthorizedClmm {
    pub program_id: Pubkey,
    pub donation_protocol: Pubkey,
}
