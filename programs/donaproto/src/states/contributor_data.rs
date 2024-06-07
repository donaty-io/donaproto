use anchor_lang::prelude::*;
use std::mem;

use super::DISCRIMINATOR_LEN;

#[account]
#[derive(Default)]
pub struct ContributorData {
    pub total_amount_donated: u64,
    pub total_amount_earned: u64,
    pub donations_count: u64,
    pub donation_protocol: Pubkey,
    pub bump: u8,
}

impl ContributorData {
    const TOTAL_AMOUNT_DONATED_LEN: usize = mem::size_of::<u64>();
    const TOTAL_AMOUNT_EARNED_LEN: usize = mem::size_of::<u64>();
    const DONATIONS_COUNT_LEN: usize = mem::size_of::<u64>();
    const DONATION_PROTOCOL_LEN: usize = mem::size_of::<Pubkey>();
    const BUMP_LEN: usize = mem::size_of::<u8>();
    pub const LEN: usize = DISCRIMINATOR_LEN
        + ContributorData::TOTAL_AMOUNT_DONATED_LEN
        + ContributorData::TOTAL_AMOUNT_EARNED_LEN
        + ContributorData::DONATIONS_COUNT_LEN
        + ContributorData::DONATION_PROTOCOL_LEN
        + ContributorData::BUMP_LEN;
}
