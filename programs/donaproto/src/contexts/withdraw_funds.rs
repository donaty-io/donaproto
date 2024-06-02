use anchor_lang::prelude::*;
use crate::{CreatorData, DonationData, DonationProtocolData, HOLDING_PREFIX};
use anchor_spl::token::{Mint, TokenAccount};


#[derive(Accounts)]
pub struct WithdrawFunds<'info> {
  #[account(mut,
    constraint = donation_data.donation_protocol == donation_protocol.key(),
    constraint = donation_data.holding_wallet == holding_wallet.key(),
    constraint = donation_data.creator_data == creator_data.key(),
  )]
  pub donation_data: Account<'info, DonationData>,
  #[account(mut,
    constraint = creator_data.donation_protocol == donation_protocol.key(),
  )]
  pub creator_data: Account<'info, CreatorData>,
  pub donation_protocol: Account<'info, DonationProtocolData>,

  #[account(mut,
    constraint = holding_wallet.mint == donation_mint.key(),
    constraint = holding_wallet.key() == donation_data.holding_wallet,
  )]
  pub holding_wallet: Account<'info, TokenAccount>,
  #[account(
    seeds = [
      HOLDING_PREFIX.as_bytes(), 
      donation_data.to_account_info().key.as_ref(),
    ],
    bump = donation_data.holding_bump,
  )]
  /// CHECK: pda account ["holding", donation_data]
  pub holding_wallet_owner: AccountInfo<'info>,
  #[account(mut,
    constraint = recipient_token_wallet.owner == *payer.key,
    constraint = recipient_token_wallet.mint == donation_mint.key(),
  )]
  pub recipient_token_wallet: Account<'info, TokenAccount>,
  #[account(
    constraint = donation_protocol.donation_mint.key() == donation_mint.key(),
  )]
  pub donation_mint: Account<'info, Mint>,
  #[account(mut)]
  pub payer: Signer<'info>,
  pub token_program: Program<'info, anchor_spl::token::Token>,
}