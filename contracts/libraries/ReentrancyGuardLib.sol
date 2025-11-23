// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

library ReentrancyGuardLib {
    error Reentrant();
    error ReentrantInternal();

    // Storage slot for reentrancy guard (Shanghai compatible - uses regular storage instead of transient storage)
    // Uses keccak256(address(this), "reentrancy_guard") to get a unique slot per contract
    bytes32 private constant REENTRANCY_GUARD_SLOT = keccak256("reentrancy_guard");

    function _guard() internal {
        bytes4 selector = Reentrant.selector;

        assembly ("memory-safe") {
            // Compute unique storage slot: keccak256(address(this), "reentrancy_guard")
            let slotKey := 0x7265656e7472616e63795f677561726400000000000000000000000000000000 // "reentrancy_guard" padded to 32 bytes
            mstore(0, address())
            mstore(32, slotKey)
            let slot := keccak256(0, 64)
            
            let guardValue := sload(slot)
            
            if guardValue {
                mstore(0, selector)
                revert(0, 0x04)
            }
            sstore(slot, 1)
        }
    }

    function _unlockGuard() internal {
        // Unlocks the guard, making the pattern composable.
        // After the function exits, it can be called again, even in the same transaction.
        assembly ("memory-safe") {
            let slotKey := 0x7265656e7472616e63795f677561726400000000000000000000000000000000 // "reentrancy_guard" padded to 32 bytes
            mstore(0, address())
            mstore(32, slotKey)
            let slot := keccak256(0, 64)
            sstore(slot, 0)
        }
    }

    function _internalGuard() internal {
        bytes4 selector = ReentrantInternal.selector;

        assembly ("memory-safe") {
            let slotKey := 0x7265656e7472616e63795f677561726400000000000000000000000000000000 // "reentrancy_guard" padded to 32 bytes
            mstore(0, address())
            mstore(32, slotKey)
            let slot := keccak256(0, 64)
            
            let guardValue := sload(slot)
            
            switch guardValue
            case 1 { 
                sstore(slot, 2) // Disable internal reentrancies
            }
            default {
                mstore(0, selector)
                revert(0, 0x04)
            }
        }
    }
}