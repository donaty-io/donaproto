use anchor_lang::prelude::*;


#[account]
#[derive(Default)]
#[derive(InitSpace)]
pub struct DonationProtocolData {
    pub treasury_mint: Pubkey,
    pub treasury: Pubkey,
    pub donation_mint: Pubkey,
    pub authority: Pubkey,
    pub min_amount_to_earn: u64,
    pub min_amount_to_collect: u64,
    pub treasury_owner_bump: u8,
}
