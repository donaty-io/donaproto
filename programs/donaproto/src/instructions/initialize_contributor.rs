use anchor_lang::prelude::*;

use crate::states::{ContributorData, DonationProtocolData};

pub const CONTRIBUTOR_PREFIX: &str = "contributor";

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
    pub rent: Sysvar<'info, Rent>,
}

pub fn initialize_contributor(ctx: Context<InitializeContributor>, bump: u8) -> Result<()> {
    // TODO: verify bump
    let contributor_data = &mut ctx.accounts.contributor_data;
    contributor_data.total_amount_donated = 0;
    contributor_data.total_amount_earned = 0;
    contributor_data.donations_count = 0;
    contributor_data.donation_protocol = ctx.accounts.donation_protocol.key();
    contributor_data.bump = bump;

    Ok(())
}
