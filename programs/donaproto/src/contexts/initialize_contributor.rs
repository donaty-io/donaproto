use anchor_lang::prelude::*;
use std::mem;
use crate::{common::DISCRIMINATOR_LEN, DonationProtocolData};

pub const CONTRIBUTOR_PREFIX: &str = "contributor";

#[account]
#[derive(Default)]
pub struct ContributorData {
    pub total_amount_donated: u64,
    pub total_amount_earned: u64,
    pub donations_count: u64,
}

impl ContributorData {
  const TOTAL_AMOUNT_DONATED_LEN: usize = mem::size_of::<u64>();
  const TOTAL_AMOUNT_EARNED_LEN: usize = mem::size_of::<u64>();
  const DONATIONS_COUNT_LEN: usize = mem::size_of::<u64>();
  pub const LEN: usize = DISCRIMINATOR_LEN
    + ContributorData::TOTAL_AMOUNT_DONATED_LEN
    + ContributorData::TOTAL_AMOUNT_EARNED_LEN
    + ContributorData::DONATIONS_COUNT_LEN;
}


#[derive(Accounts)]
pub struct InitializeContributor<'info> {
  #[account(init, payer = payer, space = ContributorData::LEN,
    seeds = [
      CONTRIBUTOR_PREFIX.as_bytes(),
      donation_protocol.to_account_info().key.as_ref(),
      contributor_wallet_address.key.as_ref(),
    ],
    bump,
  )]
  pub contributor_data: Account<'info, ContributorData>,
  pub donation_protocol: Account<'info, DonationProtocolData>,
  /// CHECK: System account for which the ContributorData is being initialized
  pub contributor_wallet_address: AccountInfo<'info>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>
}