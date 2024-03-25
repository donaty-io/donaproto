use anchor_lang::prelude::*;
use std::mem;
use crate::{common::DISCRIMINATOR_LEN, DonationProtocolData};

pub const CREATOR_PREFIX: &str = "creator";

#[account]
#[derive(Default)]
pub struct CreatorData {
    pub total_amount_received: u64,
    pub total_amount_collecting: u64,
    pub donations_created_count: u64,
    pub donations_closed_count: u64,
    pub donation_protocol: Pubkey,
}

impl CreatorData {
  const TOTAL_AMOUNT_RECEIVED_LEN: usize = mem::size_of::<u64>();
  const TOTAL_AMOUNT_COLLECTING_LEN: usize = mem::size_of::<u64>();
  const DONATIONS_CREATED_COUNT_LEN: usize = mem::size_of::<u64>();
  const DONATIONS_CLOSED_COUNT_LEN: usize = mem::size_of::<u64>();
  const DONATION_PROTOCOL_LEN: usize = mem::size_of::<Pubkey>();
  pub const LEN: usize = DISCRIMINATOR_LEN
    + CreatorData::TOTAL_AMOUNT_RECEIVED_LEN
    + CreatorData::TOTAL_AMOUNT_COLLECTING_LEN
    + CreatorData::DONATIONS_CREATED_COUNT_LEN
    + CreatorData::DONATIONS_CLOSED_COUNT_LEN
    + CreatorData::DONATION_PROTOCOL_LEN;
}


#[derive(Accounts)]
pub struct InitializeCreator<'info> {
  #[account(init, payer = payer, space = CreatorData::LEN,
    seeds = [
      CREATOR_PREFIX.as_bytes(),
      donation_protocol.to_account_info().key.as_ref(),
      creator_wallet_address.key.as_ref(),
    ],
    bump,
  )]
  pub creator_data: Account<'info, CreatorData>,
  pub donation_protocol: Account<'info, DonationProtocolData>,
  /// CHECK: System account for which the CreatorData is being initialized
  pub creator_wallet_address: AccountInfo<'info>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>
}