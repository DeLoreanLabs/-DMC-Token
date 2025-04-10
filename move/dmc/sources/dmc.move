/// Module: dmc
module dmc::dmc;

use sui::coin::{Self};
use sui::url;
use sui::pay;

use dmc::treasury::{Self};


const COIN_DECIMALS: u8 = 9;
const SYMBOL: vector<u8> = b"DMC";
const NAME: vector<u8> = b"DeLorean";
const DESCRIPTION: vector<u8> = b"This is the official token that powers the DeLorean Web3 ecosystem";
// TBD, will be updated before publishing
const ICON_URL: vector<u8> = b"https://storage.googleapis.com/tokenimage.deloreanlabs.com/DMCTokenIcon.svg";

const TOTAL_SUPPLY: u64 = 12_800_000_000_000_000_000;

public struct DMC has drop {}

fun init(witness: DMC, ctx: &mut TxContext) {

    let icon_url = if (ICON_URL == b"") {
        option::none()
    } else {
        option::some(url::new_unsafe_from_bytes(ICON_URL))
    };

    let (mut treasury_cap, metadata) = coin::create_currency(
        witness,
        COIN_DECIMALS,
        SYMBOL,
        NAME,
        DESCRIPTION,
        icon_url,
        ctx,
    );

    // Mint the total supply of `DMC` tokens.
    let balance = treasury_cap.mint_balance(TOTAL_SUPPLY);
    let coin = coin::from_balance(balance, ctx);
    pay::keep(coin, ctx);

    transfer::public_freeze_object(metadata);

    // Wrap the `TreasuryCap` in a shared object to disallow mutating the token supply.
    let wrapped_treasury = treasury::wrap(treasury_cap, ctx);
    treasury::share(wrapped_treasury);
}
