use anchor_lang::prelude::*;
use anchor_spl::token::Mint;
use raydium_amm_v3::states::{AmmConfig, PoolState};

use crate::states::{AuthorizedClmm, AuthorizedClmmPool, DonationProtocolData, DISCRIMINATOR_LEN};

pub const AUTHORIZED_CLMM_POOL_PREFIX: &str = "authorized_clmm_pool";

#[derive(Accounts)]
pub struct AuthorizeClmmPool<'info> {
    #[account(init, payer = payer, space = DISCRIMINATOR_LEN + AuthorizedClmmPool::INIT_SPACE,
        seeds = [
            AUTHORIZED_CLMM_POOL_PREFIX.as_bytes(),
            donation_protocol.key().as_ref(),
            pool_state.key().as_ref(),
        ],
        bump,
    )]
    pub authorized_clmm_pool: Account<'info, AuthorizedClmmPool>,
    /// DEX pool state with current token pair price
    #[account(
        constraint = (pool_state.load()?.token_mint_0 == donation_protocol.donation_mint && pool_state.load()?.token_mint_1 == donation_amm_mint.key())
            || (pool_state.load()?.token_mint_1 == donation_protocol.donation_mint && pool_state.load()?.token_mint_0 == donation_amm_mint.key()),
        constraint = pool_state.load()?.amm_config == amm_config.key(),
    )]
    pub pool_state: AccountLoader<'info, PoolState>,
    pub amm_config: Box<Account<'info, AmmConfig>>,
    #[account(
        constraint = donation_protocol.authority == payer.key(),
    )]
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

pub fn authorize_clmm_pool(ctx: Context<AuthorizeClmmPool>) -> Result<()> {
    let authorized_clmm_pool = &mut ctx.accounts.authorized_clmm_pool;
    authorized_clmm_pool.pool_state = ctx.accounts.pool_state.key();
    authorized_clmm_pool.program_id = ctx.accounts.authorized_clmm.program_id;
    authorized_clmm_pool.token = ctx.accounts.donation_amm_mint.key();
    authorized_clmm_pool.donation_protocol = ctx.accounts.donation_protocol.key();

    Ok(())
}
