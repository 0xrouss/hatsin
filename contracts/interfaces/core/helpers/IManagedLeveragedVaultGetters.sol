// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IManagedLeveragedVault} from "src/interfaces/core/boyco/IManagedLeveragedVault.sol";

interface IManagedLeveragedVaultGetters {
    // ─── BoycoVault getters ─────────────────────────────────────────
    function vault() external view returns (IManagedLeveragedVault);
    function metaCore() external view returns (address);
    function borrowerOps() external view returns (address);
    function lsp() external view returns (address);
    function denManager() external view returns (address);
    function collVault() external view returns (address);
    function nect() external view returns (address);
    function collVaultRouter() external view returns (address);
    function denICR() external view returns (uint64);
    function keeper() external view returns (address);
    function isAuthorized(address who) external view returns (bool);

    // ─── ManagedLeveragedVault getters ──────────────────────────────
    function exposureToken() external view returns (address);
    function maxDeviationICRbp() external view returns (uint16);
    function maxWithdrawalLossbp() external view returns (uint16);
    function maxCompensationbp() external view returns (uint16);
    function entryFeebp() external view returns (uint16);
    function exitFeebp() external view returns (uint16);
    function realizeLossThrbp() external view returns (uint16);
    function epochOffset() external view returns (uint256);
    function withdrawableWrappedAssets() external view returns (uint256);
    function threshold(bytes32 key) external view returns (uint16);
    function reportAt(uint256 idx) external view returns (bytes32);
    function swapperWhitelist(address swapper) external view returns (bool);

    // ─── Aggregate getters ──────────────────────────────────────────
    function getParameters() external view returns (IManagedLeveragedVault.VaultParameters memory);
    function getRemainingStorage()
        external
        view
        returns (address metaCore_, address lsp_, address collVault_, address nect_, address collVaultRouter_);
    function getBoycoVaultStorage()
        external
        view
        returns (address, address, address, address, address, address, address, address);

    // ─── Epoch report data ──────────────────────────────────────────
    struct EpochReportData {
        uint256 totalShares;
        uint256 wrappedAssets;
        bool reported;
        bool lossRealized;
    }

    function getEpochReport(uint256 epoch) external view returns (EpochReportData memory);
    function getReportBalanceOf(uint256 epoch, address who) external view returns (uint256);

    function getExposureValue(uint256 amount) external view returns (uint256);
    function getCollateralValue(uint256 amount) external view returns (uint256);
    function getPnL() external view returns (int256);

    // ─── Loss computation ───────────────────────────────────────────
    function computeLosses(
        uint256 totalShares
    ) external view returns (
        uint256 epochValueLoss, 
        uint256 maxCollWithdrawnWithPremium, 
        uint256 nectCompensation
    );

    function getCollVaultSharesToWithdraw(uint256 _collVaultSharesRequested, uint256 _debtToUnwind, uint256 _exposureWithdrawn) external view returns (uint256);
    function getCurrentDenICR() external view returns (uint256);
    function getDebtToUnwindAndCollRequested(uint256 _epoch) external view returns (uint256 debtToUnwind, uint256 collVaultSharesRequested, uint256 shareFee, uint256 currICR);
    function assetsValuation(uint256 collVaultShares, uint256 debt, uint256 exposure) external view returns (uint256);

    // ─── Helper functions ───────────────────────────────────────────
    function getExposureValue() external view returns (uint256);
    function getDebtBalance() external view returns (uint256);
    function getCollVaultBalance() external view returns (uint256);
}
