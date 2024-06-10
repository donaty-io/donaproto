use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};
use raydium_amm_v3::states::PoolState;

use crate::{
    errors::DonationError,
    states::{AuthorizedClmmPool, CreatorData, DonationData, DonationProtocolData, MAX_IPFS_HASH_LEN},
    utils::calculate_amount, AUTHORIZED_CLMM_POOL_PREFIX, CREATOR_PREFIX, HOLDING_PREFIX,
};

#[derive(Accounts)]
pub struct CreateDonationV2<'info> {
    #[account(init, payer = creator_wallet_address, space = DonationData::LEN)]
    pub donation_data: Account<'info, DonationData>,
    #[account(
        constraint = donation_protocol.donation_mint == default_donation_mint.key(),
    )]
    pub donation_protocol: Account<'info, DonationProtocolData>,

    #[account(
        constraint = holding_wallet.owner == *holding_wallet_owner.key,
        constraint = holding_wallet.mint == donation_mint.key(),
    )]
    pub holding_wallet: Account<'info, TokenAccount>,
    #[account(
        seeds = [
            HOLDING_PREFIX.as_bytes(), 
            donation_data.to_account_info().key.as_ref(),
        ],
        bump,
    )]
    /// CHECK: pda account ["holding", donation_data]
    holding_wallet_owner: AccountInfo<'info>,

    #[account(
        constraint = recipient.mint == donation_mint.key(),
    )]
    pub recipient: Account<'info, TokenAccount>,

    #[account(mut,
        constraint = creator_data.donation_protocol.key() == donation_protocol.key(),
        seeds = [
            CREATOR_PREFIX.as_bytes(),
            donation_protocol.to_account_info().key.as_ref(),
            creator_wallet_address.key().as_ref(),
        ],
        bump,
    )]
    pub creator_data: Account<'info, CreatorData>,
    #[account(
        constraint = authorized_clmm_pool.mint == donation_mint.key(),
    )]
    pub donation_mint: Account<'info, Mint>,
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
    pub creator_wallet_address: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>
}

pub fn create_donation_v2(
    ctx: Context<CreateDonationV2>,
    amount: u64,
    ipfs_hash: String,
    ending_timestamp: u64,
    holding_bump: u8,
) -> Result<()> {
    let now_timestamp = Clock::get().expect("Time error").unix_timestamp as u64;
    if ending_timestamp <= now_timestamp {
        return Err(DonationError::InvalidEndingTimestamp.into());
    }
    if ipfs_hash.len() > MAX_IPFS_HASH_LEN {
        return Err(DonationError::IpfsHashTooLong.into());
    }
    if amount < ctx.accounts.donation_protocol.min_amount_to_collect {
        return Err(DonationError::DonationAmountTooLow.into());
    }

    let donation_data = &mut ctx.accounts.donation_data;
    donation_data.amount_collecting = amount;
    donation_data.ending_timestamp = ending_timestamp;
    donation_data.is_closed = false;
    donation_data.recipient = ctx.accounts.recipient.key();
    donation_data.creator_data = ctx.accounts.creator_data.key();
    donation_data.donation_protocol = ctx.accounts.donation_protocol.key();
    donation_data.holding_wallet = ctx.accounts.holding_wallet.key();
    donation_data.donation_mint = ctx.accounts.donation_mint.key();
    donation_data.holding_bump = holding_bump;
    donation_data.ipfs_hash = ipfs_hash;

    let default_donation_mint = &ctx.accounts.default_donation_mint;
    let donation_mint = &ctx.accounts.donation_mint;
    let is_default_token_mint_0 = ctx.accounts.pool_state.load()?.token_mint_0 == ctx.accounts.donation_protocol.donation_mint;

    let amount = calculate_amount(
        default_donation_mint.decimals,
        donation_mint.decimals,
        amount,
        ctx.accounts.pool_state.load()?.sqrt_price_x64,
        is_default_token_mint_0,
    );

    let creator_data = &mut ctx.accounts.creator_data;
    creator_data.total_amount_collecting = creator_data.total_amount_collecting.checked_add(amount).unwrap();
    creator_data.donations_created_count = creator_data.donations_created_count.checked_add(1).unwrap();

    Ok(())
}
