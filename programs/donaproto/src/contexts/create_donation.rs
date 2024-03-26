use anchor_lang::prelude::*;
use std::mem;
use crate::{common::DISCRIMINATOR_LEN, CreatorData, DonationProtocolData, CREATOR_PREFIX};
use anchor_spl::token::{Mint, TokenAccount};

pub const HOLDING_PREFIX: &str = "holding";

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
  const HOLDING_BUMP_LEN: usize = mem::size_of::<u8>();
  const IPFS_HASH_LEN: usize = MAX_IPFS_HASH_LEN;

  const LEN: usize = DISCRIMINATOR_LEN
    + DonationData::AMOUNT_COLLECTING_LEN
    + DonationData::TOTAL_AMOUNT_RECEIVED_LEN
    + DonationData::ENDING_TIMESTAMP_LEN
    + DonationData::IS_CLOSED_LEN
    + DonationData::RECIPIENT_LEN
    + DonationData::DONATION_PROTOCOL_LEN
    + DonationData::HOLDING_WALLET_LEN
    + DonationData::CREATOR_DATA_LEN
    + DonationData::HOLDING_BUMP_LEN
    + DonationData::IPFS_HASH_LEN;
}


#[derive(Accounts)]
pub struct CreateDonation<'info> {
  #[account(init, payer = creator_wallet_address, space = DonationData::LEN)]
  pub donation_data: Account<'info, DonationData>,
  #[account(
    constraint = donation_protocol.donation_mint.key() == donation_mint.key(),
  )]
  pub donation_protocol: Account<'info, DonationProtocolData>,

  #[account(
    constraint = holding_wallet.owner == *holding_wallet_owner.key,
    constraint = holding_wallet.mint == donation_mint.key(),
  )]
  pub holding_wallet: Account<'info, TokenAccount>,
  #[account(
    seeds = [
      HOLDING_PREFIX.as_bytes(), 
      donation_data.to_account_info().key.as_ref(),
    ],
    bump,
  )]
  /// CHECK: pda account ["holding", donation_data]
  holding_wallet_owner: AccountInfo<'info>,

  #[account(
    constraint = recipient.mint == donation_mint.key(),
  )]
  pub recipient: Account<'info, TokenAccount>,

  #[account(mut,
    constraint = creator_data.donation_protocol.key() == donation_protocol.key(),
    seeds = [
      CREATOR_PREFIX.as_bytes(),
      donation_protocol.to_account_info().key.as_ref(),
      creator_wallet_address.key().as_ref(),
    ],
    bump,
  )]
  pub creator_data: Account<'info, CreatorData>,
  pub donation_mint: Account<'info, Mint>,
  #[account(mut)]
  pub creator_wallet_address: Signer<'info>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>
}