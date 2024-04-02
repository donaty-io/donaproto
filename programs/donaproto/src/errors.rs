use anchor_lang::prelude::*;

#[error_code]
pub enum DonationError {
    #[msg("Invalid ending timestamp")]
    InvalidEndingTimestamp,
    #[msg("Invalid bump")]
    InvalidBump,
    #[msg("Donation is closed")]
    DonationClosed,
    #[msg("Donation amount can not be zero")]
    DonationAmountZero,
    #[msg("Donation ending requirements not met")]
    DonationEndingReqiuirementsNotMet,
    #[msg("Ipfs hash too long")]
    IpfsHashTooLong,
}
