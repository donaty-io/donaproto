use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, TokenAccount};

use crate::{errors::DonationError, states::{CreatorData, DonationData, DonationProtocolData, MAX_IPFS_HASH_LEN}, CREATOR_PREFIX};

pub const HOLDING_PREFIX: &str = "holding";


#[derive(Accounts)]
pub struct CreateDonation<'info> {
    #[account(init, payer = creator_wallet_address, space = DonationData::LEN)]
    pub donation_data: Account<'info, DonationData>,
    #[account(
        constraint = donation_protocol.donation_mint.key() == donation_mint.key(),
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
    pub donation_mint: Account<'info, Mint>,
    #[account(mut)]
    pub creator_wallet_address: Signer<'info>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>
}

pub fn create_donation(
    ctx: Context<CreateDonation>,
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
    donation_data.holding_bump = holding_bump;
    donation_data.ipfs_hash = ipfs_hash;

    let creator_data = &mut ctx.accounts.creator_data;
    creator_data.total_amount_collecting = creator_data.total_amount_collecting.checked_add(amount).unwrap();
    creator_data.donations_created_count = creator_data.donations_created_count.checked_add(1).unwrap();

    Ok(())
}
