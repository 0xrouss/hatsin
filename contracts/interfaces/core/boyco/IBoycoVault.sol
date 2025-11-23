// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {DenManager} from "src/core/DenManager.sol";
import {IBorrowerOperations} from "src/interfaces/core/IBorrowerOperations.sol";
import {IMetaHatsinCore} from "src/interfaces/core/IMetaHatsinCore.sol";
import {ILiquidStabilityPool} from "src/interfaces/core/ILiquidStabilityPool.sol";
import {IDebtToken} from "src/interfaces/core/IDebtToken.sol";
import {IPriceFeed} from "src/interfaces/core/IPriceFeed.sol";
import {IRebalancer} from "src/interfaces/utils/integrations/IRebalancer.sol";
import {IBaseCollateralVault} from "src/interfaces/core/vaults/IBaseCollateralVault.sol";

/// @title IBoycoVault Interface
/// @notice Interface for the BoycoVault contract that handles deposits and withdrawals
interface IBoycoVault is IERC4626 {
    enum PromotionState {
        DuringPromotion,
        AfterPromotion
    }

    struct InitParams {
        IERC20 _asset;
        string _sharesName;
        string _sharesSymbol;
        IMetaHatsinCore _metaHatsinCore;
        IBorrowerOperations _borrowerOperations;
        address _denManager;
        ILiquidStabilityPool _lsp;
        IBaseCollateralVault _collVault;
        IDebtToken _nect;
        uint16 _nectOutThreshold;
        uint16 _threshold;
        address _boycoRelayer;
        uint64 _denICR;
    }

    struct OpenBoycoDenParams {
        uint256 balance;
        uint256 maxFeePercentage;
        uint256 minCollVaultShares;
        uint256 minLSPShares;
    }

    struct PartialRedeemToOneParams {
        uint256 minTargetTokenAmount;
        uint256[] outputQuotes;
        uint256[] outputMins;
        bytes[] pathDefinitions;
        address executor;
        uint32 referralCode;
    }

    struct AdjustBoycoDenParams {
        uint256 maxFeePercentage;
        uint256 balance;
        uint256 collWithdrawal;
        uint256 debtChange;
        bool isDebtIncrease;
        uint256 minCollVaultShares;
        uint256 minLSPShares;
        PartialRedeemToOneParams collRouterParams;
    }

    struct RebalanceParams {
        uint256 sentAmount;
        address swapper;
        uint256 minNectOut;
        bytes payload;
    }

    // Errors
    error ZeroAddress();
    error PromotionEnded();
    error NectThresholdTooLow(uint256 actual, uint256 threshold);
    error PromotionActive();
    error NotOwner(address sender);
    error AlreadyOpened();
    error BoycoDenNotOpened();
    error BoycoDenNotClosed();
    error NotBoyco(address sender);
    error SNectRebalancesNotFinished();
    error VaultSlippage(uint256 expected, uint256 actual);
    error InsufficientBalance(uint256 currentBalance, uint256 assetAmount);
    error AlreadyHealthy(uint256 currentICR);
    error KeeperCooldown(uint64 lastOp, uint64 timestamp);
    error InvalidRepayment();
    error PositionNotImproved(uint256 newICR);
    error OverImprovedPosition(uint256 newICR);
    error DenAlreadyExists();
    error ZeroSupply();
    error NoCollateralWithdrawal();
    error OnlyCollateralWithdrawal(address token);

    // PROXY
    function upgradeToAndCall(address newImplementation, bytes calldata data) external;
    function getCurrentImplementation() external view returns (address);

    // Core functions
    function initialize(InitParams calldata params) external;
    function openBoycoDen(OpenBoycoDenParams calldata params) external;
    function adjustBoycoDen(AdjustBoycoDenParams calldata params) external;
    function closeBoycoDen(PartialRedeemToOneParams calldata collRouterParams) external;
    function emergencyDebtRepayment(
        RebalanceParams calldata rebalanceParams,
        AdjustBoycoDenParams calldata repaymentParams
    ) external;
    function rebalanceSNectToNect(RebalanceParams calldata params) external returns (uint);
    function emergencyCollateralRecovery(
        uint shares,
        address[] calldata preferredUnderlyingTokens,
        uint minCollReceived
    ) external;
    function unwrapCollVaultToAsset(PartialRedeemToOneParams calldata collRouterParams) external;
    function claimCollateral(PartialRedeemToOneParams calldata collRouterParams) external;

    // Setters
    function setDenICR(uint64 denICR) external;
    function setPairThreshold(uint16 thresholdInBP) external;
    function setBoycoAuthorized(address boyco, bool authorized) external;
    function setKeeper(address keeper) external;
    function setMetaHatsinCore(address metaHatsinCore) external;
    function setBorrowerOperations(address borrowerOperations) external;
    function setDenManager(address denManager) external;
    function setLiquidStabilityPool(address lsp) external;
    function setCollVaultRouter(address collVaultRouter) external;
    function setDelegateApproval(address delegate, bool isApproved) external;
    function endPromotion() external;

    // Getters
    function isBoycoAuthorized(address boyco) external view returns (bool);
    function getPromotionState() external view returns (PromotionState);
    function getBoycoDenState() external view returns (DenManager.Status);
    function borrowerOperations() external view returns (IBorrowerOperations);
    function getPrice(address token) external view returns (uint256);
    function getPriceFeed() external view returns (IPriceFeed);
    function keeper() external view returns(address);
    function lastKeeperOp() external view returns(uint64);
    function denICR() external view returns(uint64);
    function threshold() external view returns(uint16);
    function nectOutThreshold() external view returns(uint16);
    function collVaultRouter() external view returns(address);
    function nect() external view returns(address);
    function denManager() external view returns(address);
    function collVault() external view returns(address);
    function lsp() external view returns (address);
    function metaHatsinCore() external view returns(address);
}
