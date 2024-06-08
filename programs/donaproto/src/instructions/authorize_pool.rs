use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use raydium_amm_v3::states::{AmmConfig, PoolState, POOL_SEED};

use crate::states::{AuthorizedClmm, AuthorizedPool, DonationProtocolData, DISCRIMINATOR_LEN};

pub const AUTHORIZED_POOL_PREFIX: &str = "authorized_pool";

#[derive(Accounts)]
pub struct AuthorizePool<'info> {
    #[account(init, payer = payer, space = DISCRIMINATOR_LEN + AuthorizedPool::INIT_SPACE,
        seeds = [
            AUTHORIZED_POOL_PREFIX.as_bytes(),
            donation_protocol.key().as_ref(),
            pool_state.key().as_ref(),
        ],
        bump,
    )]
    pub authorized_pool: Account<'info, AuthorizedPool>,
    /// DEX pool state with current token pair price
    #[account(
        seeds = [
            POOL_SEED.as_bytes(),
            amm_config.key().as_ref(),
            donation_amm_mint.key().as_ref(),
            donation_protocol.donation_mint.key().as_ref(),
        ],
        seeds::program = authorized_clmm.program_id.key(),
        bump,
    )]
    pub pool_state: AccountLoader<'info, PoolState>,
    pub amm_config: Box<Account<'info, AmmConfig>>,
    pub donation_protocol: Account<'info, DonationProtocolData>,
    pub donation_amm_mint: Account<'info, Mint>,
    #[account(
        constraint = authorized_clmm.donation_protocol == donation_protocol.key(),
    )]
    pub authorized_clmm: Account<'info, AuthorizedClmm>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

pub fn authorize_pool(ctx: Context<AuthorizePool>) -> Result<()> {
    let authorized_pool = &mut ctx.accounts.authorized_pool;
    authorized_pool.pool_state = ctx.accounts.pool_state.key();
    authorized_pool.program_id = ctx.accounts.authorized_clmm.program_id;
    authorized_pool.token = ctx.accounts.donation_amm_mint.key();
    authorized_pool.donation_protocol = ctx.accounts.donation_protocol.key();

    Ok(())
}
