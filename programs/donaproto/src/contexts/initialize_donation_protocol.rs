use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};
use std::mem;
use crate::common::DISCRIMINATOR_LEN;

pub const TREASURY_PREFIX: &str = "treasury";

#[account]
#[derive(Default)]
pub struct DonationProtocolData {
    pub treasury_mint: Pubkey,
    pub treasury: Pubkey,
    pub donation_mint: Pubkey,
    pub min_amount_to_earn: u64,
    pub treasury_owner_bump: u8
}

impl DonationProtocolData {
  const TREASURY_MINT_LEN: usize = mem::size_of::<Pubkey>();
  const TREASURY_LEN: usize = mem::size_of::<Pubkey>();
  const DONATION_MINT_LEN: usize = mem::size_of::<Pubkey>();
  const MIN_AMOUNT_TO_EARN_LEN: usize = mem::size_of::<u64>();
  const TREASURY_OWNER_BUMP_LEN: usize = mem::size_of::<u8>();
  pub const LEN: usize = DISCRIMINATOR_LEN
    + DonationProtocolData::TREASURY_MINT_LEN
    + DonationProtocolData::TREASURY_LEN
    + DonationProtocolData::DONATION_MINT_LEN
    + DonationProtocolData::MIN_AMOUNT_TO_EARN_LEN
    + DonationProtocolData::TREASURY_OWNER_BUMP_LEN;
}

#[derive(Accounts)]
pub struct InitializeDonationProtocol<'info> {
  #[account(init, payer = payer, space = DonationProtocolData::LEN)]
  pub donation_protocol_data: Account<'info, DonationProtocolData>,

  #[account(
    constraint = treasury.owner == *treasury_owner.key,
    constraint = treasury.mint == token_mint.key(),
  )]
  pub treasury: Account<'info, TokenAccount>,
  #[account(
    seeds = [TREASURY_PREFIX.as_bytes(), donation_protocol_data.key().as_ref()],
    bump,
  )]
  /// CHECK: pda account ["treasury", donation_protocol_data]
  pub treasury_owner: AccountInfo<'info>,
  pub token_mint: Account<'info, Mint>,
  pub donation_mint: Account<'info, Mint>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub system_program: Program<'info, System>,
  pub rent: Sysvar<'info, Rent>
}
