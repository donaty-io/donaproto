use anchor_lang::prelude::*;
use crate::{ContributorData, DonationData, DonationProtocolData, CONTRIBUTOR_PREFIX, TREASURY_PREFIX};
use anchor_spl::token::{Mint, TokenAccount};

#[derive(Accounts)]
pub struct Donate<'info> {
  #[account(mut,
    constraint = donation_data.donation_protocol == donation_protocol.key(),
    constraint = donation_data.holding_wallet == holding_wallet.key(),
  )]
  pub donation_data: Account<'info, DonationData>,
  #[account(mut,
    constraint = contributor_data.donation_protocol == donation_protocol.key(),
    seeds = [
      CONTRIBUTOR_PREFIX.as_bytes(),
      donation_protocol.to_account_info().key.as_ref(),
      user_wallet.to_account_info().key.as_ref(),
    ],
    bump = contributor_data.bump,
  )]
  pub contributor_data: Account<'info, ContributorData>,
  pub donation_protocol: Account<'info, DonationProtocolData>,

  #[account(mut,
    constraint = user_token_wallet.owner == *user_wallet.key,
    constraint = user_token_wallet.mint == donation_mint.key(),
  )]
  pub user_token_wallet: Account<'info, TokenAccount>,
  #[account(mut,
    constraint = user_reward_token_wallet.owner == *user_wallet.key,
    constraint = user_reward_token_wallet.mint == reward_mint.key(),
  )]
  pub user_reward_token_wallet: Account<'info, TokenAccount>,
  #[account(mut,
    constraint = donation_protocol.treasury_mint.key() == reward_mint.key(),
    constraint = reward_treasury.key() == donation_protocol.treasury.key(),
  )]
  pub reward_treasury: Account<'info, TokenAccount>,
  #[account(
    seeds = [TREASURY_PREFIX.as_bytes(), donation_protocol.key().as_ref()],
    bump = donation_protocol.treasury_owner_bump,
  )]
  /// CHECK: pda account ["treasury", donation_protocol_data]
  pub reward_treasury_owner: AccountInfo<'info>,

  #[account(mut,
    constraint = holding_wallet.mint == donation_mint.key(),
    constraint = holding_wallet.key() == donation_data.holding_wallet,
  )]
  pub holding_wallet: Account<'info, TokenAccount>,
  #[account(
    constraint = donation_protocol.donation_mint.key() == donation_mint.key(),
  )]
  pub donation_mint: Account<'info, Mint>,
  #[account(
    constraint = donation_protocol.treasury_mint.key() == reward_mint.key(),
  )]
  pub reward_mint: Account<'info, Mint>,

  #[account(mut)]
  pub user_wallet: Signer<'info>,
  pub token_program: Program<'info, anchor_spl::token::Token>,
}