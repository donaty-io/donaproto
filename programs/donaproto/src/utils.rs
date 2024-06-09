/// A library for handling Q64.64 fixed point numbers
/// copied from `raydium-clmm` program library
// TODO: write tests for this module

pub const Q64: u128 = (u64::MAX as u128) + 1; // 2^64
pub const RESOLUTION: u8 = 64;

pub fn multipler(decimals: u8) -> f64 {
    (10_i32).checked_pow(decimals.try_into().unwrap()).unwrap() as f64
}

pub fn from_x64_price(price: u128) -> f64 {
    price as f64 / Q64 as f64
}

pub fn sqrt_price_x64_to_price(price: u128, decimals_0: u8, decimals_1: u8) -> f64 {
    from_x64_price(price).powi(2) * multipler(decimals_0) / multipler(decimals_1)
}

pub fn identify_mint_decimals(
    default_donation_mint_decimals: u8,
    donation_mint_decimals: u8,
    is_default_token_mint_0: bool,
) -> (u8, u8) {
    if is_default_token_mint_0 {
        return (default_donation_mint_decimals, donation_mint_decimals);
    }

    (donation_mint_decimals, default_donation_mint_decimals)
}

pub fn amount_from_price(
    amount: u64,
    price: f64,
    is_default_token_mint_0: bool,
) -> u64 {
    if is_default_token_mint_0 {
        return (amount as f64 / price).round() as u64;
    }
    
    (amount as f64 * price).round() as u64
}

pub fn calculate_amount(
    default_donation_mint_decimals: u8,
    donation_mint_decimals: u8,
    amount: u64,
    sqrt_price_x64: u128,
    is_default_token_mint_0: bool,
) -> u64 {
    let (decimals_0, decimals_1) = identify_mint_decimals(
        default_donation_mint_decimals,
        donation_mint_decimals,
        is_default_token_mint_0,
    );
    let price = sqrt_price_x64_to_price(sqrt_price_x64, decimals_0, decimals_1);

    amount_from_price(amount, price, is_default_token_mint_0)
}
