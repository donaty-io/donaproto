use anchor_lang::prelude::*;

use crate::states::{AuthorizedClmm, DonationProtocolData, DISCRIMINATOR_LEN};

pub const AUTHORIZED_CLMM_PREFIX: &str = "authorized_clmm";

#[derive(Accounts)]
#[instruction(program_id: Pubkey)]
pub struct AuthorizeClmm<'info> {
    #[account(init, payer = payer, space = DISCRIMINATOR_LEN + AuthorizedClmm::INIT_SPACE,
      seeds = [
        AUTHORIZED_CLMM_PREFIX.as_bytes(),
        donation_protocol.key().as_ref(),
        program_id.as_ref(),
      ],
      bump,
    )]
    pub authorized_clmm: Account<'info, AuthorizedClmm>,
    #[account(
      constraint = donation_protocol.authority == payer.key(),
    )]
    pub donation_protocol: Account<'info, DonationProtocolData>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn authorize_clmm(ctx: Context<AuthorizeClmm>, program_id: Pubkey) -> Result<()> {
    let authorized_clmm = &mut ctx.accounts.authorized_clmm;
    authorized_clmm.program_id = program_id;
    authorized_clmm.donation_protocol = ctx.accounts.donation_protocol.key();

    Ok(())
}
