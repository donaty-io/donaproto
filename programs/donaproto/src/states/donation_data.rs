use anchor_lang::prelude::*;
use std::mem;

use super::DISCRIMINATOR_LEN;

#[account]
#[derive(Default)]
pub struct DonationData {
    pub amount_collecting: u64,
    pub total_amount_received: u64,
    pub ending_timestamp: u64,
    pub is_closed: bool,
    pub recipient: Pubkey,
    pub donation_protocol: Pubkey,
    pub holding_wallet: Pubkey,
    pub creator_data: Pubkey,
    pub donation_mint: Pubkey,
    pub holding_bump: u8,
    pub ipfs_hash: String,
}

pub const MAX_IPFS_HASH_LEN: usize = 64;

impl DonationData {
    const AMOUNT_COLLECTING_LEN: usize = mem::size_of::<u64>();
    const TOTAL_AMOUNT_RECEIVED_LEN: usize = mem::size_of::<u64>();
    const ENDING_TIMESTAMP_LEN: usize = mem::size_of::<u64>();
    const IS_CLOSED_LEN: usize = mem::size_of::<bool>();
    const RECIPIENT_LEN: usize = mem::size_of::<Pubkey>();
    const DONATION_PROTOCOL_LEN: usize = mem::size_of::<Pubkey>();
    const HOLDING_WALLET_LEN: usize = mem::size_of::<Pubkey>();
    const CREATOR_DATA_LEN: usize = mem::size_of::<Pubkey>();
    const DONATION_MINT_LEN: usize = mem::size_of::<Pubkey>();
    const HOLDING_BUMP_LEN: usize = mem::size_of::<u8>();
    const IPFS_HASH_LEN: usize = MAX_IPFS_HASH_LEN;

    pub const LEN: usize = DISCRIMINATOR_LEN
        + DonationData::AMOUNT_COLLECTING_LEN
        + DonationData::TOTAL_AMOUNT_RECEIVED_LEN
        + DonationData::ENDING_TIMESTAMP_LEN
        + DonationData::IS_CLOSED_LEN
        + DonationData::RECIPIENT_LEN
        + DonationData::DONATION_PROTOCOL_LEN
        + DonationData::HOLDING_WALLET_LEN
        + DonationData::CREATOR_DATA_LEN
        + DonationData::DONATION_MINT_LEN
        + DonationData::HOLDING_BUMP_LEN
        + DonationData::IPFS_HASH_LEN;
}
