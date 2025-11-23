// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IManagedLeveragedVault} from "src/interfaces/core/boyco/IManagedLeveragedVault.sol";
import {ManagedLeveragedVaultStorageLib} from "src/libraries/ManagedLeveragedVaultStorageLib.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IDenManager} from "src/interfaces/core/IDenManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IAsset} from "src/interfaces/utils/tokens/IAsset.sol";
import {HatsinMath} from "src/dependencies/HatsinMath.sol";
import {FeeLib} from "src/libraries/FeeLib.sol";
import {PriceLib} from "src/libraries/PriceLib.sol";


contract ManagedLeveragedVaultGetters {
    using Math for uint256;
    using FeeLib for uint256;
    using PriceLib for uint256;

    IManagedLeveragedVault public immutable vault;
    uint8 constant COLL_VAULT_DECIMALS = 18; 
    
    uint256 constant WAD = 1e18;
    uint256 constant BP = 1e4;

    error AmountZero();
    error BadDebt(uint256 amountInUsd);

    constructor(IManagedLeveragedVault _vault) {
        vault = _vault;
    }

    // ─── BoycoVault getters ─────────────────────────────────────────
    function metaCore() public view returns (address) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.metaCoreSlot());
        return address(uint160(uint256(vault.extSloads(slot)[0])));
    }

    function borrowerOps() public view returns (address) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.borrowerOpsSlot());
        return address(uint160(uint256(vault.extSloads(slot)[0])));
    }

    function lsp() public view returns (address) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.lspSlot());
        return address(uint160(uint256(vault.extSloads(slot)[0])));
    }

    function denManager() public view returns (address) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.denManagerSlot());
        return address(uint160(uint256(vault.extSloads(slot)[0])));
    }

    function collVault() public view returns (address) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.collVaultSlot());
        return address(uint160(uint256(vault.extSloads(slot)[0])));
    }

    function nect() public view returns (address) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.nectSlot());
        return address(uint160(uint256(vault.extSloads(slot)[0])));
    }

    function collVaultRouter() public view returns (address) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.collVaultRouterSlot());
        return address(uint160(uint256(vault.extSloads(slot)[0])));
    }

    function denICR() public view returns (uint64) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.denICRSlot());
        return uint64(uint256(vault.extSloads(slot)[0]) >> ManagedLeveragedVaultStorageLib.DEN_ICR_BITS);
    }

    function keeper() public view returns (address) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.keeperSlot());
        return address(uint160(uint256(vault.extSloads(slot)[0]) >> ManagedLeveragedVaultStorageLib.KEEPER_BITS));
    }

    function isAuthorized(address who) external view returns (bool) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.boycoAuthMapSlot(who));
        return uint8(uint256(vault.extSloads(slot)[0])) == 1;
    }

    // ─── ManagedLeveragedVault getters ──────────────────────────────
    function exposureToken() public view returns (address) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.exposureTokenSlot());
        return address(uint160(uint256(vault.extSloads(slot)[0])));
    }

    function maxDeviationICRbp() public view returns (uint16) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.maxDeviationICRbpSlot());
        return uint16(uint256(vault.extSloads(slot)[0]) >> ManagedLeveragedVaultStorageLib.MAX_DEV_ICR_BP_BITS);
    }

    function maxWithdrawalLossbp() public view returns (uint16) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.maxWithdrawalLossbpSlot());
        return uint16(uint256(vault.extSloads(slot)[0]) >> ManagedLeveragedVaultStorageLib.MAX_WD_LOSS_BP_BITS);
    }

    function maxCompensationbp() public view returns (uint16) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.maxCompSlot());
        return uint16(uint256(vault.extSloads(slot)[0]) >> ManagedLeveragedVaultStorageLib.MAX_COMP_BP_BITS);
    }

    function entryFeebp() public view returns (uint16) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.entryFeebpSlot());
        return uint16(uint256(vault.extSloads(slot)[0]) >> ManagedLeveragedVaultStorageLib.ENTRY_FEE_BP_BITS);
    }

    function exitFeebp() public view returns (uint16) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.exitFeebpSlot());
        return uint16(uint256(vault.extSloads(slot)[0]) >> ManagedLeveragedVaultStorageLib.EXIT_FEE_BP_BITS);
    }

    function realizeLossThrbp() public view returns (uint16) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.realizeLossThrSlot());
        return uint16(uint256(vault.extSloads(slot)[0]) >> ManagedLeveragedVaultStorageLib.REALIZE_LOSS_THR_BITS);
    }

    function epochOffset() public view returns (uint256) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.epochOffsetSlot());
        return uint256(uint256(vault.extSloads(slot)[0]));
    }

    function withdrawableWrappedAssets() external view returns (uint256) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.withdrawableWrappedAssetsSlot());
        return uint256(uint256(vault.extSloads(slot)[0]));
    }

    function threshold(bytes32 key) external view returns (uint16) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.thresholdMapSlot(key));
        return uint16(uint256(vault.extSloads(slot)[0]));
    }

    function reportAt(uint256 idx) external view returns (bytes32) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.reportsMapSlot(idx));
        return vault.extSloads(slot)[0];
    }

    function swapperWhitelist(address swapper) external view returns (bool) {
        bytes32[] memory slot = _array(ManagedLeveragedVaultStorageLib.swapperWhitelistSlot(swapper));
        return uint8(uint256(vault.extSloads(slot)[0])) == 1;
    }

    // ─── internal helper ────────────────────────────────────────────
    function _array(bytes32 x) private pure returns (bytes32[] memory) {
        bytes32[] memory res = new bytes32[](1);
        res[0] = x;
        return res;
    }

    /// @notice Returns all core vault parameters in one call
    function getParameters() external view returns (IManagedLeveragedVault.VaultParameters memory) {
        return IManagedLeveragedVault.VaultParameters({
            denICR: denICR(),
            maxDeviationICRinBP: maxDeviationICRbp(),
            denManager: denManager(),
            keeper: keeper(),
            borrowerOperations: borrowerOps(),
            entryFeeInBP: entryFeebp(),
            exitFeeInBP: exitFeebp(),
            maxCompensationInBP: maxCompensationbp(),
            realizeLossThresholdInBP: realizeLossThrbp(),
            epochOffset: epochOffset(),
            withdrawalMaxLossInBP: maxWithdrawalLossbp(),
            exposureToken: exposureToken(),
            mlvGetters: address(this)
        });
    }

    /// @notice Returns remaining immutable addresses in storage
    function getRemainingStorage()
        external
        view
        returns (address metaCore_, address lsp_, address collVault_, address nect_, address collVaultRouter_)
    {
        return (metaCore(), lsp(), collVault(), nect(), collVaultRouter());
    }

    function getBoycoVaultStorage()
        external
        view
    returns (address, address, address, address, address, address, address, address) {

        return (
            metaCore(),
            borrowerOps(),
            lsp(),
            denManager(),
            collVault(),
            nect(),
            collVaultRouter(),
            keeper()
        );
    }

    // All non‐mapping fields
    struct EpochReportData {
        uint256 totalShares;
        uint256 wrappedAssets;
        bool reported;
        bool lossRealized;
    }

    function getEpochReport(uint256 epoch) public view returns (EpochReportData memory) {
        // Fetch “base slot” of reports[epoch]
        bytes32 base = ManagedLeveragedVaultStorageLib.reportsMapSlot(epoch);

        // the struct (in storage) is laid out as:
        //   slot(base + 0): <mapping seed, not used for reads>
        //   slot(base + 1): totalShares
        //   slot(base + 2): wrappedAssets
        //   slot(base + 3): packed bools { reported (byte0), lossRealized (byte1) }
        bytes32[] memory slots = new bytes32[](3);
        for (uint i; i < slots.length; i++) {
            slots[i] = bytes32(uint256(base) + (i + 1));
        }

        bytes32[] memory data = vault.extSloads(slots);

        uint256 totalShares = uint256(data[0]);
        uint256 wrappedAssets = uint256(data[1]);
        bytes32 flags = data[2];

        bool reported = uint8(uint256(flags)) != 0;
        bool lossRealized = uint8(uint256(flags) >> 8) != 0;

        return EpochReportData({
            totalShares: totalShares,
            wrappedAssets: wrappedAssets,
            reported: reported,
            lossRealized: lossRealized
        });
    }

    function getDebtToUnwindAndCollRequested(uint256 _epoch) external view returns (uint256 debtToUnwind, uint256 collVaultSharesRequested, uint256 shareFee, uint256 currICR) {
        uint256 totalShares = getEpochReport(_epoch).totalShares;

        if (totalShares == 0) revert AmountZero();

        uint256 requestedAssets;
        (requestedAssets, shareFee) = _previewRedeem(totalShares);

        collVaultSharesRequested = _assetsToCollVaultShares(requestedAssets);

        (uint256 collVaultShares, uint256 debt) = IDenManager(denManager()).getDenCollAndDebt(address(vault));

        currICR = HatsinMath._computeCR(collVaultShares, debt, IDenManager(denManager()).fetchPrice());

        // Find proportional debt unwind to collateral, so that ICR is unchanged, we assume an already pretty close ICR
        // If we were to responsabilize withdrawers to targetICR with a current deviated denICR, it would only responsabilize them to pay the slippage/borrow costs
        // Instead, we responsabilize both withdrawers and depositors, only using `increaseLeverage` and `decreaseLeverage`, which socializes losses
        debtToUnwind = debt.mulDiv(collVaultSharesRequested, collVaultShares);
    }

    function _previewRedeem(uint256 shares) internal view returns (uint256 assets, uint256 shareFee) {
        shareFee = shares.feeOnRaw(exitFeebp());
        assets = IERC4626(address(vault)).previewRedeem(shares - shareFee);
    }

    function _assetsToCollVaultShares(uint256 assets) internal view returns (uint256) {
        return IERC4626(collVault()).previewDeposit(assets);
    }

    function assetsValuation(uint256 collVaultShares, uint256 debt, uint256 exposure) public view returns (uint256) {
        uint256 collateralValue = _getCollateralValue(collVaultShares);
        uint256 exposureValue = _getExposureValue(exposure);
        uint256 debtValue = debt; // Soft peg NECT to $1
        
        if (debtValue > collateralValue + exposureValue) {
            revert BadDebt(debtValue - (collateralValue + exposureValue));
        }
        
        uint256 netValue = collateralValue + exposureValue - debtValue;
        address asset = IERC4626(address(vault)).asset();
        uint256 assetPrice = vault.getPrice(asset);
        uint8 assetDecimals = IAsset(asset).decimals();
        
        uint256 assets = netValue.mulDiv(10 ** assetDecimals, assetPrice);
        
        return assets;
    }

    // Helper function to get collateral value in USD
    function _getCollateralValue(uint256 amount) internal view returns (uint256) {
        uint256 price = vault.getPrice(collVault());
        
        return amount.convertToValue(price, 18); // COLL_VAULT_DECIMALS
    }

    function _getExposureValue(uint256 amount) internal view returns (uint256) {
        /// @dev Points to `setSpotOracle` of `LSPOracle::fetchPrice` (sNECT) or `LSPOracle::fetchPrice * totalAssets / totalSupply` (BB.SNECT)
        uint256 price = vault.getPrice(exposureToken());
        uint8 _decimals = IAsset(exposureToken()).decimals();

        return amount.convertToValue(price, _decimals);
    }

    function computeLosses(
        uint256 totalShares
    ) external view returns (
        uint256 epochValueLoss, 
        uint256 maxCollWithdrawnWithPremium, 
        uint256 nectCompensation
    ) {
        // Calculate values
        uint256 debtValue = getDebtBalance(); // Already implemented getter
        uint256 exposureValue = getExposureValue(); // Already implemented getter
        uint256 totalSupply = IERC4626(address(vault)).totalSupply();

        // Calculate total value loss
        uint256 totalValueLoss = debtValue > exposureValue ? debtValue - exposureValue : 0;

        // Get price from vault's price feed
        uint256 price = vault.getPrice(collVault());

        // Calculate epoch value loss proportional to shares
        epochValueLoss = totalShares.mulDiv(
            totalValueLoss,
            totalSupply,
            Math.Rounding.Up
        );

        // Calculate NECT compensation
        nectCompensation = Math.min(
            epochValueLoss * maxCompensationbp() / BP,
            IERC20(nect()).balanceOf(address(vault))
        );
        epochValueLoss -= nectCompensation;

        // Calculate collateral loss
        uint256 epochColLoss = epochValueLoss.mulDiv(
            WAD,
            price,
            Math.Rounding.Up
        );

        // Calculate max collateral withdrawal with premium
        maxCollWithdrawnWithPremium = Math.min(
            getCollVaultBalance(), // Already implemented getter
            epochColLoss.mulDiv(BP + realizeLossThrbp(), BP)
        );
    }

    function getCurrentDenICR() public view returns (uint256) {
        address denManagerAddr = denManager();
        IDenManager denManager = IDenManager(denManagerAddr);

        uint256 collPrice = denManager.fetchPrice();

        return denManager.getCurrentICR(address(vault), collPrice);
    }

    function getCollVaultSharesToWithdraw(uint256 _collVaultSharesRequested, uint256 _debtToUnwind, uint256 _exposureWithdrawn) public view returns (uint256) {
        address collVaultAddr = collVault();

        // Instead of recalculating totalAssets, which socializes the loss to everyone
        // Let's see how much the loss was, and apply it to the withdrawer by substracting the collVaultShares to withdraw
        uint256 exposureWithdrawnValue = _getExposureValue(_exposureWithdrawn);
        /// @dev Most cases will present a loss, but in case of profit, we don't add coll
        uint256 slippageLossInUsd = exposureWithdrawnValue > _debtToUnwind ? exposureWithdrawnValue - _debtToUnwind : 0;
        uint256 slippageLossInColl = slippageLossInUsd.convertToAmount(vault.getPrice(collVaultAddr), COLL_VAULT_DECIMALS, Math.Rounding.Up);
        return _collVaultSharesRequested - slippageLossInColl;
    }

    // Helper function to get exposure value - moved from main contract
    function getExposureValue() public view returns (uint256) {
        address exposureTokenAddr = exposureToken();
        uint256 balance = IERC20(exposureTokenAddr).balanceOf(address(vault));
        uint256 price = vault.getPrice(exposureTokenAddr);
        uint8 decimals = IAsset(exposureTokenAddr).decimals();
        
        return balance.mulDiv(price, 10**decimals);
    }

    // Helper function to get debt balance - moved from main contract
    function getDebtBalance() public view returns (uint256) {
        address denManagerAddr = denManager();
        (, uint256 debt) = IDenManager(denManagerAddr).getDenCollAndDebt(address(vault));
        return debt;
    }

    // Helper function to get collateral balance - moved from main contract
    function getCollVaultBalance() public view returns (uint256) {
        address denManagerAddr = denManager();
        IDenManager denManager = IDenManager(denManagerAddr);

        (uint256 collVaultShares,) = denManager.getDenCollAndDebt(address(vault));
        collVaultShares += denManager.surplusBalances(address(vault));

        return collVaultShares;
    }

    function getExposureValue(uint256 amount) public view returns (uint256) {
        address exposureTokenAddr = exposureToken();
        uint256 price = vault.getPrice(exposureTokenAddr);
        uint8 _decimals = IAsset(exposureTokenAddr).decimals();

        return amount.convertToValue(price, _decimals);
    }

    // Helper function to get collateral value in USD
    function getCollateralValue(uint256 amount) public view returns (uint256) {
        address collVaultAddr = collVault();
        uint256 price = vault.getPrice(collVaultAddr);
        
        return amount.convertToValue(price, COLL_VAULT_DECIMALS);
    }

    function getPnL() public view returns (int256) {
        return int256(getExposureValue()) - int256(getDebtBalance());
    }

    // Separate getter for the mapping(address→uint256) inside the struct
    function getReportBalanceOf(uint256 epoch, address who) external view returns (uint256) {
        bytes32 base = ManagedLeveragedVaultStorageLib.reportsMapSlot(epoch);
        bytes32 elemSlot = keccak256(abi.encode(who, base)); 
        bytes32[] memory slot = _array(elemSlot);
        bytes32[] memory value = vault.extSloads(slot);
        return uint256(value[0]);
    }
}
