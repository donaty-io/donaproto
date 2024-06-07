use anchor_lang::prelude::*;
use std::mem;

use super::DISCRIMINATOR_LEN;

#[account]
#[derive(Default)]
pub struct DonationProtocolData {
    pub treasury_mint: Pubkey,
    pub treasury: Pubkey,
    pub donation_mint: Pubkey,
    pub min_amount_to_earn: u64,
    pub min_amount_to_collect: u64,
    pub treasury_owner_bump: u8,
}

impl DonationProtocolData {
    const TREASURY_MINT_LEN: usize = mem::size_of::<Pubkey>();
    const TREASURY_LEN: usize = mem::size_of::<Pubkey>();
    const DONATION_MINT_LEN: usize = mem::size_of::<Pubkey>();
    const MIN_AMOUNT_TO_EARN_LEN: usize = mem::size_of::<u64>();
    const MIN_AMOUNT_TO_COLLECT_LEN: usize = mem::size_of::<u64>();
    const TREASURY_OWNER_BUMP_LEN: usize = mem::size_of::<u8>();

    pub const LEN: usize = DISCRIMINATOR_LEN
        + DonationProtocolData::TREASURY_MINT_LEN
        + DonationProtocolData::TREASURY_LEN
        + DonationProtocolData::DONATION_MINT_LEN
        + DonationProtocolData::MIN_AMOUNT_TO_EARN_LEN
        + DonationProtocolData::MIN_AMOUNT_TO_COLLECT_LEN
        + DonationProtocolData::TREASURY_OWNER_BUMP_LEN;
}
