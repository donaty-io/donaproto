use anchor_lang::prelude::*;
pub mod instructions;
use instructions::*;

pub mod errors;
pub mod states;

declare_id!("HbNNG85aBuR9W5F8YobTeDRRmXWFbDhLDS6WbLzWbLhH");

#[program]
pub mod donaproto {
    use super::*;

    pub fn initialize_donation_protocol(
        ctx: Context<InitializeDonationProtocol>,
        min_amount_to_earn: u64,
        min_amount_to_collect: u64,
        treasury_owner_bump: u8,
    ) -> Result<()> {
        instructions::initialize_donation_protocol(
            ctx,
            min_amount_to_earn,
            min_amount_to_collect,
            treasury_owner_bump,
        )
    }

    pub fn initialize_creator(ctx: Context<InitializeCreator>) -> Result<()> {
        instructions::initialize_creator(ctx)
    }

    pub fn initialize_contributor(ctx: Context<InitializeContributor>, bump: u8) -> Result<()> {
        instructions::initialize_contributor(ctx, bump)
    }

    pub fn create_donation(
        ctx: Context<CreateDonation>,
        amount: u64,
        ipfs_hash: String,
        ending_timestamp: u64,
        holding_bump: u8,
    ) -> Result<()> {
        instructions::create_donation(ctx, amount, ipfs_hash, ending_timestamp, holding_bump)
    }

    pub fn donate(ctx: Context<Donate>, amount: u64) -> Result<()> {
        instructions::donate(ctx, amount)
    }

    pub fn withdraw_funds(ctx: Context<WithdrawFunds>) -> Result<()> {
        instructions::withdraw_funds(ctx)
    }

    pub fn authorize_clmm(ctx: Context<AuthorizeClmm>, program_id: Pubkey) -> Result<()> {
        instructions::authorize_clmm(ctx, program_id)
    }

    pub fn authorize_clmm_pool(ctx: Context<AuthorizeClmmPool>) -> Result<()> {
        instructions::authorize_clmm_pool(ctx)
    }
}
