use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, TokenAccount, Transfer};

use crate::{errors::DonationError, states::{CreatorData, DonationData, DonationProtocolData}, HOLDING_PREFIX};


#[derive(Accounts)]
pub struct WithdrawFunds<'info> {
    #[account(mut,
      constraint = donation_data.donation_protocol == donation_protocol.key(),
      constraint = donation_data.holding_wallet == holding_wallet.key(),
      constraint = donation_data.creator_data == creator_data.key(),
    )]
    pub donation_data: Account<'info, DonationData>,
    #[account(mut,
      constraint = creator_data.donation_protocol == donation_protocol.key(),
    )]
    pub creator_data: Account<'info, CreatorData>,
    pub donation_protocol: Account<'info, DonationProtocolData>,

    #[account(mut,
      constraint = holding_wallet.mint == donation_mint.key(),
      constraint = holding_wallet.key() == donation_data.holding_wallet,
    )]
    pub holding_wallet: Account<'info, TokenAccount>,
    #[account(
      seeds = [
        HOLDING_PREFIX.as_bytes(), 
        donation_data.to_account_info().key.as_ref(),
      ],
      bump = donation_data.holding_bump,
    )]
    /// CHECK: pda account ["holding", donation_data]
    pub holding_wallet_owner: AccountInfo<'info>,
    #[account(mut,
      constraint = recipient_token_wallet.owner == *payer.key,
      constraint = recipient_token_wallet.mint == donation_mint.key(),
    )]
    pub recipient_token_wallet: Account<'info, TokenAccount>,
    #[account(
      constraint = donation_protocol.donation_mint.key() == donation_mint.key(),
    )]
    pub donation_mint: Account<'info, Mint>,
    #[account(mut)]
    pub payer: Signer<'info>,
    pub token_program: Program<'info, anchor_spl::token::Token>,
}

  pub fn withdraw_funds(ctx: Context<WithdrawFunds>) -> Result<()> {
    let donation_data = &mut ctx.accounts.donation_data;

    if donation_data.is_closed {
        return Err(DonationError::DonationClosed.into());
    }

    if donation_data.ending_timestamp > Clock::get().expect("Time error").unix_timestamp as u64
        && donation_data.total_amount_received < donation_data.amount_collecting
    {
        return Err(DonationError::DonationEndingReqiuirementsNotMet.into());
    }

    // use withdraw_funds_v2.rs if donation mint is different
    // bc fair calculation of rewards is linkend with donation protocol mint
    if ctx.accounts.donation_mint.key() != ctx.accounts.donation_protocol.donation_mint {
        return Err(DonationError::InvalidDonationMint.into());
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
                to: ctx
                    .accounts
                    .recipient_token_wallet
                    .to_account_info()
                    .clone(),
                authority: ctx.accounts.holding_wallet_owner.to_account_info().clone(),
            },
            signer,
        ),
        donation_data.total_amount_received,
    )?;

    let creator_data = &mut ctx.accounts.creator_data;
    creator_data.total_amount_received = creator_data
        .total_amount_received
        .checked_add(donation_data.total_amount_received)
        .unwrap();
    creator_data.donations_closed_count =
        creator_data.donations_closed_count.checked_add(1).unwrap();
    donation_data.is_closed = true;

    Ok(())
}
