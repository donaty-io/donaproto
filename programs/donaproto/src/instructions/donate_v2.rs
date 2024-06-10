use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, TokenAccount, Transfer};
use raydium_amm_v3::states::PoolState;

use crate::{
    errors::DonationError,
    states::{AuthorizedClmmPool, ContributorData, DonationData, DonationProtocolData},
    utils::calculate_amount,
    AUTHORIZED_CLMM_POOL_PREFIX, CONTRIBUTOR_PREFIX, TREASURY_PREFIX,
};

#[derive(Accounts)]
pub struct DonateV2<'info> {
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
    #[account(
      constraint = donation_protocol.donation_mint == default_donation_mint.key(),
    )]
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
      constraint = authorized_clmm_pool.mint == donation_mint.key(),
    )]
    pub donation_mint: Account<'info, Mint>,
    #[account(
      constraint = donation_protocol.treasury_mint.key() == reward_mint.key(),
    )]
    pub reward_mint: Account<'info, Mint>,

    pub default_donation_mint: Account<'info, Mint>,
    #[account(
        seeds = [
            AUTHORIZED_CLMM_POOL_PREFIX.as_bytes(),
            donation_protocol.key().as_ref(),
            pool_state.key().as_ref(),
        ],
        bump,
        constraint = authorized_clmm_pool.donation_protocol == donation_protocol.key(),
        constraint = authorized_clmm_pool.pool_state == pool_state.key(),
    )]
    pub authorized_clmm_pool: Account<'info, AuthorizedClmmPool>,
    #[account(
        constraint = (pool_state.load()?.token_mint_0 == donation_protocol.donation_mint && pool_state.load()?.token_mint_1 == donation_mint.key())
            || (pool_state.load()?.token_mint_1 == donation_protocol.donation_mint && pool_state.load()?.token_mint_0 == donation_mint.key()),
    )]
    pub pool_state: AccountLoader<'info, PoolState>,

    #[account(mut)]
    pub user_wallet: Signer<'info>,
    pub token_program: Program<'info, anchor_spl::token::Token>,
}

pub fn donate_v2(ctx: Context<DonateV2>, amount: u64) -> Result<()> {
    let donation_data = &mut ctx.accounts.donation_data;

    if donation_data.is_closed {
        return Err(DonationError::DonationClosed.into());
    }

    if amount == 0 {
        return Err(DonationError::DonationAmountZero.into());
    }

    if ctx.accounts.donation_protocol.donation_mint == ctx.accounts.donation_mint.key() {
        return Err(DonationError::InvalidDonationMint.into());
    }

    let default_donation_mint = &ctx.accounts.default_donation_mint;
    let donation_mint = &ctx.accounts.donation_mint;
    let is_default_token_mint_0 = ctx.accounts.pool_state.load()?.token_mint_0
        == ctx.accounts.donation_protocol.donation_mint;
    let default_amount = calculate_amount(
        default_donation_mint.decimals,
        donation_mint.decimals,
        amount,
        ctx.accounts.pool_state.load()?.sqrt_price_x64,
        is_default_token_mint_0,
    );

    // Transfer amount from user to donation holding wallet in specific token mints
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info().clone(),
            Transfer {
                from: ctx.accounts.user_token_wallet.to_account_info().clone(),
                to: ctx.accounts.holding_wallet.to_account_info().clone(),
                authority: ctx.accounts.user_wallet.to_account_info().clone(),
            },
        ),
        amount,
    )?;

    let contributor_data = &mut ctx.accounts.contributor_data;
    donation_data.total_amount_received = donation_data
        .total_amount_received
        .checked_add(amount)
        .unwrap();
    contributor_data.total_amount_donated = contributor_data
        .total_amount_donated
        .checked_add(default_amount)
        .unwrap();
    contributor_data.donations_count = contributor_data.donations_count.checked_add(1).unwrap();
    let donation_protocol = &ctx.accounts.donation_protocol;

    if default_amount >= donation_protocol.min_amount_to_earn {
        // TODO: add calculation for reward amount
        let reward_treasury_balance = ctx.accounts.reward_treasury.amount;
        let mut reward_amount = default_amount;
        if reward_amount > reward_treasury_balance {
            reward_amount = reward_treasury_balance.checked_div(100).unwrap();
        }
        // END

        // Transfer amount of tokens from reward treasury wallet to user
        let seeds = &[
            TREASURY_PREFIX.as_bytes(),
            ctx.accounts
                .donation_protocol
                .to_account_info()
                .key
                .as_ref(),
            &[ctx.accounts.donation_protocol.treasury_owner_bump],
        ];
        let signer = &[&seeds[..]];
        if reward_amount > 0 {
            token::transfer(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info().clone(),
                    Transfer {
                        from: ctx.accounts.reward_treasury.to_account_info().clone(),
                        to: ctx
                            .accounts
                            .user_reward_token_wallet
                            .to_account_info()
                            .clone(),
                        authority: ctx.accounts.reward_treasury_owner.to_account_info().clone(),
                    },
                    signer,
                ),
                reward_amount,
            )?;
            contributor_data.total_amount_earned = contributor_data
                .total_amount_earned
                .checked_add(reward_amount)
                .unwrap();
        }
    }

    Ok(())
}
