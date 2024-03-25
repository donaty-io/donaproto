use anchor_lang::prelude::*;

#[error_code]
pub enum DonationError {
    #[msg("Invalid ending timestamp")]
    InvalidEndingTimestamp,
}
