use anchor_lang::prelude::*;

use crate::states::{CreatorData, DonationProtocolData};

pub const CREATOR_PREFIX: &str = "creator";


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

pub fn initialize_creator(ctx: Context<InitializeCreator>) -> Result<()> {
  // TODO: verify bump
  let creator_data = &mut ctx.accounts.creator_data;
  creator_data.donation_protocol = ctx.accounts.donation_protocol.key();
  creator_data.donations_closed_count = 0;
  creator_data.donations_created_count = 0;
  creator_data.total_amount_collecting = 0;
  creator_data.total_amount_received = 0;

  Ok(())
}
