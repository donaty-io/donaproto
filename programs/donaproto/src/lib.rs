use anchor_lang::prelude::*;
mod contexts;
use contexts::*;
use std::time::{SystemTime, UNIX_EPOCH};

pub mod errors;

use crate::errors::DonationError;

declare_id!("8o6xeX4NsYXwbwJCdeG7g4dbrQ1V98JtS9qwFWgWfYay");

#[program]
pub mod donaproto {
    use super::*;

    pub fn initialize_donation_protocol(
        ctx: Context<InitializeDonationProtocol>,
        min_amount_to_earn: u64,
        treasury_owner_bump: u8,
    ) -> Result<()> {
        let donation_data = &mut ctx.accounts.donation_protocol_data;
        donation_data.treasury_mint = ctx.accounts.token_mint.key();
        donation_data.treasury = ctx.accounts.treasury.key();
        donation_data.donation_mint = ctx.accounts.donation_mint.key();
        donation_data.min_amount_to_earn = min_amount_to_earn;
        donation_data.treasury_owner_bump = treasury_owner_bump;

        Ok(())
    }

    pub fn initialize_contributor(
        ctx: Context<InitializeContributor>
    ) -> Result<()> {
        let contributor_data = &mut ctx.accounts.contributor_data;
        contributor_data.total_amount_donated = 0;
        contributor_data.total_amount_earned = 0;
        contributor_data.donations_count = 0;

        Ok(())
    }

    pub fn create_donation(
        ctx: Context<CreateDonation>,
        amount: u64,
        ipfs_hash: String,
        ending_timestamp: u64,
        holding_bump: u8,
    ) -> Result<()> {
        let now = SystemTime::now();
        let now_timestamp = now.duration_since(UNIX_EPOCH).expect("Solana Time error").as_secs();
        if ending_timestamp <= now_timestamp {
            return Err(DonationError::InvalidEndingTimestamp.into());
        }

        let donation_data = &mut ctx.accounts.donation_data;
        donation_data.amount_collecting = amount;
        donation_data.ending_timestamp = ending_timestamp;
        donation_data.is_closed = false;
        donation_data.recipient = ctx.accounts.recipient.key();
        donation_data.donation_protocol = ctx.accounts.donation_protocol.key();
        donation_data.holding_wallet = ctx.accounts.holding_wallet.key();
        donation_data.holding_bump = holding_bump;
        donation_data.ipfs_hash = ipfs_hash;

        Ok(())
    }
}
