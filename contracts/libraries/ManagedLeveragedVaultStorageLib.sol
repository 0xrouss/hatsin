// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

library ManagedLeveragedVaultStorageLib {
    // storage-location constants
    bytes32 internal constant BOYCO_VAULT_LOC = 0x4b90d93bac34893618b51d871d9c8b3d48e01de187fe858a7a76d35f03985700;
    bytes32 internal constant MLV_VAULT_LOC = 0x12ca37b393c412d053690654fb6d504d2a16c55c2bd10941af581f2221d9c100;

    // ─── BoycoVaultStorage slots ────────────────────────────────────────────────
    uint256 internal constant _META_CORE_SLOT = 0;
    uint256 internal constant _AUTH_MAPPING_SLOT = 1;
    uint256 internal constant _BORROW_OPS_SLOT = 2;
    uint256 internal constant _LSP_SLOT = 3;
    uint256 internal constant _DEN_MANAGER_SLOT = 4;
    uint256 internal constant _COLL_VAULT_SLOT = 5;
    uint256 internal constant _NECT_SLOT = 6;
    uint256 internal constant _COLL_ROUTER_SLOT = 7;
    uint256 internal constant _NECT_OUT_THR_SLOT = 7;
    uint256 internal constant _THR_UNUSED_SLOT = 7;
    uint256 internal constant _DEN_ICR_SLOT = 7;
    uint256 internal constant _PROMO_STATE_SLOT = 8;
    uint256 internal constant _KEEPER_SLOT = 8;
    uint256 internal constant _LAST_KEEPER_OP_SLOT = 8;

    // bit offsets within slot 7
    uint256 internal constant COLL_VAULT_ROUTER_BITS = 0;
    uint256 internal constant NECT_OUT_THRESHOLD_BITS = 160;
    uint256 internal constant THRESHOLD_BITS_UNUSED = 176;
    uint256 internal constant DEN_ICR_BITS = 192;

    // bit offsets within slot 8
    uint256 internal constant PROMO_STATE_BITS = 0;
    uint256 internal constant KEEPER_BITS = 8;
    uint256 internal constant LAST_KEEPER_OP_BITS = 168;

    // BoycoVault simple-slot getters
    function metaCoreSlot() internal pure returns (bytes32) {
        return bytes32(uint256(BOYCO_VAULT_LOC) + _META_CORE_SLOT);
    }

    function borrowerOpsSlot() internal pure returns (bytes32) {
        return bytes32(uint256(BOYCO_VAULT_LOC) + _BORROW_OPS_SLOT);
    }

    function lspSlot() internal pure returns (bytes32) {
        return bytes32(uint256(BOYCO_VAULT_LOC) + _LSP_SLOT);
    }

    function denManagerSlot() internal pure returns (bytes32) {
        return bytes32(uint256(BOYCO_VAULT_LOC) + _DEN_MANAGER_SLOT);
    }

    function collVaultSlot() internal pure returns (bytes32) {
        return bytes32(uint256(BOYCO_VAULT_LOC) + _COLL_VAULT_SLOT);
    }

    function nectSlot() internal pure returns (bytes32) {
        return bytes32(uint256(BOYCO_VAULT_LOC) + _NECT_SLOT);
    }

    function collVaultRouterSlot() internal pure returns (bytes32) {
        return bytes32(uint256(BOYCO_VAULT_LOC) + _COLL_ROUTER_SLOT);
    }

    function denICRSlot() internal pure returns (bytes32) {
        return bytes32(uint256(BOYCO_VAULT_LOC) + _DEN_ICR_SLOT);
    }

    function keeperSlot() internal pure returns (bytes32) {
        return bytes32(uint256(BOYCO_VAULT_LOC) + _KEEPER_SLOT);
    }

    // BoycoVault mapping-slot getters
    function boycoAuthMapSlot(address who) internal pure returns (bytes32) {
        return keccak256(abi.encode(who, bytes32(uint256(BOYCO_VAULT_LOC) + _AUTH_MAPPING_SLOT)));
    }

    // ─── ManagedLeveragedVaultStorage slots ────────────────────────────────────
    uint256 internal constant _EXPOSURE_TOKEN_SLOT = 0;
    uint256 internal constant _MAX_DEV_ICR_BP_SLOT = 0;
    uint256 internal constant _MAX_WD_LOSS_BP_SLOT = 0;
    uint256 internal constant _ENTRY_FEE_BP_SLOT = 0;
    uint256 internal constant _EXIT_FEE_BP_SLOT = 0;
    uint256 internal constant _MAX_COMP_BP_SLOT = 0;
    uint256 internal constant _REALIZE_LOSS_THR_SLOT = 0;
    uint256 internal constant _EPOCH_OFFSET_SLOT = 1;
    uint256 internal constant _WITHDRAWABLE_ASSETS_SLOT = 2;
    uint256 internal constant _THRESHOLD_MAP_SLOT = 3;
    uint256 internal constant _REPORTS_MAP_SLOT = 4;
    uint256 internal constant _SWAPPER_WHITELIST_SLOT = 5;

    // slot 0 bit-offsets for tightly-packed fields:
    uint256 internal constant EXPOSURE_TOKEN_BITS = 0;
    uint256 internal constant MAX_DEV_ICR_BP_BITS = 160;
    uint256 internal constant MAX_WD_LOSS_BP_BITS = 176;
    uint256 internal constant ENTRY_FEE_BP_BITS = 192;
    uint256 internal constant EXIT_FEE_BP_BITS = 208;
    uint256 internal constant MAX_COMP_BP_BITS = 224;
    uint256 internal constant REALIZE_LOSS_THR_BITS = 240;

    // ManagedLeveragedVaultStorage simple-slot getters
    function exposureTokenSlot() internal pure returns (bytes32) {
        return bytes32(uint256(MLV_VAULT_LOC) + _EXPOSURE_TOKEN_SLOT);
    }

    function maxDeviationICRbpSlot() internal pure returns (bytes32) {
        return bytes32(uint256(MLV_VAULT_LOC) + _MAX_DEV_ICR_BP_SLOT);
    }

    function maxWithdrawalLossbpSlot() internal pure returns (bytes32) {
        return bytes32(uint256(MLV_VAULT_LOC) + _MAX_WD_LOSS_BP_SLOT);
    }

    function entryFeebpSlot() internal pure returns (bytes32) {
        return bytes32(uint256(MLV_VAULT_LOC) + _ENTRY_FEE_BP_SLOT);
    }

    function exitFeebpSlot() internal pure returns (bytes32) {
        return bytes32(uint256(MLV_VAULT_LOC) + _EXIT_FEE_BP_SLOT);
    }

    function maxCompSlot() internal pure returns (bytes32) {
        return bytes32(uint256(MLV_VAULT_LOC) + _MAX_COMP_BP_SLOT);
    }

    function realizeLossThrSlot() internal pure returns (bytes32) {
        return bytes32(uint256(MLV_VAULT_LOC) + _REALIZE_LOSS_THR_SLOT);
    }

    function epochOffsetSlot() internal pure returns (bytes32) {
        return bytes32(uint256(MLV_VAULT_LOC) + _EPOCH_OFFSET_SLOT);
    }

    function withdrawableWrappedAssetsSlot() internal pure returns (bytes32) {
        return bytes32(uint256(MLV_VAULT_LOC) + _WITHDRAWABLE_ASSETS_SLOT);
    }

    // ManagedLeveragedVaultStorage mapping-slot getters
    function thresholdMapSlot(bytes32 key) internal pure returns (bytes32) {
        return keccak256(abi.encode(key, bytes32(uint256(MLV_VAULT_LOC) + _THRESHOLD_MAP_SLOT)));
    }

    function reportsMapSlot(uint256 idx) internal pure returns (bytes32) {
        return keccak256(abi.encode(idx, bytes32(uint256(MLV_VAULT_LOC) + _REPORTS_MAP_SLOT)));
    }

    function swapperWhitelistSlot(address swapper) internal pure returns (bytes32) {
        return keccak256(abi.encode(swapper, bytes32(uint256(MLV_VAULT_LOC) + _SWAPPER_WHITELIST_SLOT)));
    }
}