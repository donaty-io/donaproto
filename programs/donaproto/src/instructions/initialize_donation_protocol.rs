use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

use crate::states::{DonationProtocolData, DISCRIMINATOR_LEN};

pub const TREASURY_PREFIX: &str = "treasury";

#[derive(Accounts)]
pub struct InitializeDonationProtocol<'info> {
    #[account(init, payer = payer, space = DISCRIMINATOR_LEN + DonationProtocolData::INIT_SPACE)]
    pub donation_protocol_data: Account<'info, DonationProtocolData>,

    #[account(
      constraint = treasury.owner == *treasury_owner.key,
      constraint = treasury.mint == treasury_mint.key(),
    )]
    pub treasury: Account<'info, TokenAccount>,
    #[account(
      seeds = [TREASURY_PREFIX.as_bytes(), donation_protocol_data.key().as_ref()],
      bump,
    )]
    /// CHECK: pda account ["treasury", donation_protocol_data]
    pub treasury_owner: AccountInfo<'info>,
    pub treasury_mint: Account<'info, Mint>,
    pub donation_mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn initialize_donation_protocol(
    ctx: Context<InitializeDonationProtocol>,
    min_amount_to_earn: u64,
    min_amount_to_collect: u64,
    treasury_owner_bump: u8,
) -> Result<()> {
    let donation_data = &mut ctx.accounts.donation_protocol_data;
    donation_data.treasury_mint = ctx.accounts.treasury_mint.key();
    donation_data.treasury = ctx.accounts.treasury.key();
    donation_data.donation_mint = ctx.accounts.donation_mint.key();
    donation_data.min_amount_to_earn = min_amount_to_earn;
    donation_data.treasury_owner_bump = treasury_owner_bump;
    donation_data.min_amount_to_collect = min_amount_to_collect;
    donation_data.authority = *ctx.accounts.payer.key;

    Ok(())
}
