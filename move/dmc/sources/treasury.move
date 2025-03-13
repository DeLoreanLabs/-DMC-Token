/// This module defines the `WrappedTreasury` and associated functions to manage a
/// `TreasuryCap` in a secure way. By wrapping the `TreasuryCap` in a shared, immutable
/// object, this module ensures the total token supply cannot be modified.
/// The `TreasuryCap` is stored as a Dynamic Object Field (DOF) within the
/// `WrappedTreasury` object. Using a DOF maintains discoverability and accessibility for
/// on-chain interactions, allowing functions like `total_supply` to retrieve the current
/// total token circulation.
module dmc::treasury;

use sui::coin::TreasuryCap;
use sui::dynamic_object_field as dof;

/// [Shared] Wrap the `TreasuryCap` in an object to stop mutation of the supply.
public struct WrappedTreasury<phantom T> has key {
    id: UID,
}

/// Save the `TreasuryCap` as a DOF, to maintain discoverability.
public struct TreasuryCapKey() has copy, store, drop;

/// Wrap a `TreasuryCap<T>` in a `WrappedTreasury<T>` object.
/// `WrappedTreasury<T>` must be shared.
public(package) fun wrap<T>(
    treasury_cap: TreasuryCap<T>,
    ctx: &mut TxContext,
): WrappedTreasury<T> {
    let mut id = object::new(ctx);
    dof::add(&mut id, TreasuryCapKey(), treasury_cap);

    WrappedTreasury { id }
}

/// Returns the total number of tokens in circulation by accessing the `TreasuryCap`
/// within the `WrappedTreasury`. This function is read-only and returns the supply
/// for users and external queries, ensuring transparency around token circulation.
public fun total_supply<T>(self: &WrappedTreasury<T>): u64 {
    let immut_cap = dof::borrow<TreasuryCapKey, TreasuryCap<T>>(
        &self.id,
        TreasuryCapKey(),
    );

    immut_cap.total_supply()
}

#[allow(lint(share_owned))]
public fun share<T>(treasury: WrappedTreasury<T>) {
    transfer::share_object(treasury)
}
