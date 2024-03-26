use anchor_lang::prelude::*;
mod contexts;
use contexts::*;
use std::time::{SystemTime, UNIX_EPOCH};
use anchor_spl::token::{self, Transfer};

pub mod errors;

use crate::errors::DonationError;

declare_id!("5HZRPHtJPhD5MvG1Sv71NwuiN5F51wXjnSQeey95chpA");

#[program]
pub mod donaproto {
    use super::*;

    pub fn initialize_donation_protocol(
        ctx: Context<InitializeDonationProtocol>,
        min_amount_to_earn: u64,
        treasury_owner_bump: u8,
    ) -> Result<()> {
        let donation_data = &mut ctx.accounts.donation_protocol_data;
        donation_data.treasury_mint = ctx.accounts.treasury_mint.key();
        donation_data.treasury = ctx.accounts.treasury.key();
        donation_data.donation_mint = ctx.accounts.donation_mint.key();
        donation_data.min_amount_to_earn = min_amount_to_earn;
        donation_data.treasury_owner_bump = treasury_owner_bump;

        Ok(())
    }

    pub fn initialize_creator(
        ctx: Context<InitializeCreator>,
    ) -> Result<()> {
        // TODO: verify bump
        let creator_data = &mut ctx.accounts.creator_data;
        creator_data.donation_protocol = ctx.accounts.donation_protocol.key();
        creator_data.donations_closed_count = 0;
        creator_data.donations_created_count = 0;
        creator_data.total_amount_collecting = 0;
        creator_data.total_amount_received = 0;

        Ok(())
    }

    pub fn initialize_contributor(
        ctx: Context<InitializeContributor>,
        bump: u8,
    ) -> Result<()> {
        // TODO: verify bump
        let contributor_data = &mut ctx.accounts.contributor_data;
        contributor_data.total_amount_donated = 0;
        contributor_data.total_amount_earned = 0;
        contributor_data.donations_count = 0;
        contributor_data.donation_protocol = ctx.accounts.donation_protocol.key();
        contributor_data.bump = bump;

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

        let creator_data = &mut ctx.accounts.creator_data;
        creator_data.total_amount_collecting.checked_add(amount).unwrap();
        creator_data.donations_created_count.checked_add(1).unwrap();

        Ok(())
    }

    pub fn donate(
        ctx: Context<Donate>,
        amount: u64,
    ) -> Result<()> {
        let donation_data = &mut ctx.accounts.donation_data;
        let contributor_data = &mut ctx.accounts.contributor_data;
        let donation_protocol = &ctx.accounts.donation_protocol;

        if donation_data.is_closed {
            return Err(DonationError::DonationClosed.into());
        }

        if amount == 0 {
            return Err(DonationError::DonationAmountZero.into());
        }

        // Transfer amount from user to donation holding wallet
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info().clone(),
                Transfer {
                    from: ctx.accounts.user_token_wallet.to_account_info().clone(),
                    to: ctx.accounts.holding_wallet.to_account_info().clone(),
                    authority: ctx
                        .accounts
                        .user_wallet
                        .to_account_info()
                        .clone(),
                },
            ),
            amount,
        )?;

        donation_data.total_amount_received.checked_add(amount).unwrap();
        contributor_data.total_amount_donated.checked_add(amount).unwrap();
        contributor_data.donations_count.checked_add(1).unwrap();

        if amount >= donation_protocol.min_amount_to_earn {
            // TODO: add calculation for reward amount
            let reward_treasury_balance = ctx.accounts.reward_treasury.amount;
            let mut reward_amount = amount.checked_div(100).unwrap();
            if reward_amount > reward_treasury_balance {
                reward_amount = reward_treasury_balance.checked_div(100).unwrap();
            }
            // END
 
            // Transfer amount of tokens from reward treasury wallet to user
            let seeds = &[
                TREASURY_PREFIX.as_bytes(),
                ctx.accounts.donation_protocol.to_account_info().key.as_ref(),
                &[ctx.accounts.donation_protocol.treasury_owner_bump],
            ];
            let signer = &[&seeds[..]];
            if reward_amount > 0 {
                token::transfer(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info().clone(),
                        Transfer {
                            from: ctx.accounts.reward_treasury.to_account_info().clone(),
                            to: ctx.accounts.user_reward_token_wallet.to_account_info().clone(),
                            authority: ctx.accounts.reward_treasury_owner.to_account_info().clone(),
                        },
                        signer,
                    ),
                    reward_amount,
                )?;
            }

        }

        Ok(())
    }

    pub fn withdraw_funds(
        ctx: Context<WithdrawFunds>,
    ) -> Result<()> {
        let donation_data = &mut ctx.accounts.donation_data;

        if donation_data.is_closed {
            return Err(DonationError::DonationClosed.into());
        }

        if donation_data.ending_timestamp > SystemTime::now().duration_since(UNIX_EPOCH).expect("Solana Time error").as_secs() {
            return Err(DonationError::DonationNotEnded.into());
        }

        // Transfer amount from donation holding wallet to recipient
        let seeds = &[
            HOLDING_PREFIX.as_bytes(),
            donation_data.to_account_info().key.as_ref(),
            &[donation_data.holding_bump],
        ];
        let signer = &[&seeds[..]];
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info().clone(),
                Transfer {
                    from: ctx.accounts.holding_wallet.to_account_info().clone(),
                    to: ctx.accounts.recipient_token_wallet.to_account_info().clone(),
                    authority: ctx
                        .accounts
                        .holding_wallet_owner
                        .to_account_info()
                        .clone(),
                },
                signer,
            ),
            donation_data.total_amount_received,
        )?;

        let creator_data = &mut ctx.accounts.creator_data;
        creator_data.total_amount_received.checked_add(donation_data.total_amount_received).unwrap();
        creator_data.donations_closed_count.checked_add(1).unwrap();
        donation_data.is_closed = true;

        Ok(())
    }
}
