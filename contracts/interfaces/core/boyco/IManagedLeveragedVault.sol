// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IERC4626} from "@openzeppelin-upgradeable/contracts/token/ERC20/extensions/ERC4626Upgradeable.sol";

interface IManagedLeveragedVault {
    enum PromotionState {
        DuringPromotion,
        AfterPromotion
    }

    enum DenStatus {
        nonExistent,
        active,
        closedByOwner,
        closedByLiquidation,
        closedByRedemption
    }

    enum Tolerance {
        ABOVE,
        BOTH
    }

    struct VaultParameters {
        uint64 denICR;
        uint16 maxDeviationICRinBP;
        address denManager;
        address keeper;
        address borrowerOperations;
        uint16 entryFeeInBP;
        uint16 exitFeeInBP;
        uint16 maxCompensationInBP;
        uint16 realizeLossThresholdInBP;
        uint16 withdrawalMaxLossInBP;
        uint256 epochOffset;
        address exposureToken;
        address mlvGetters;
    }

    struct ManagedLeveragedVaultInitParams {
        address _exposureToken;
        uint16 _maxDeviationICRinBP;
        uint16 _maxWithdrawalLossInBP;
        uint16 _entryFeeInBP;
        uint16 _exitFeeInBP;
        uint16 _maxCompensationInBP;
        uint16 _realizeLossThresholdInBP;
        uint256 _previousTotalAssets;
    }

    struct EpochReport {
        mapping(address => uint256) balanceOf;
        uint256 totalShares;
        uint256 wrappedAssets;
        bool reported;
        bool lossRealized;
    }

    struct AddCollParams {
        address upperHint;
        address lowerHint;
        uint256 minSharesOut;
        uint256 minCollVaultShares;
    }

    struct ExecuteWithdrawalParams {
        uint256 epoch;
        address upperHint;
        address lowerHint;
    }

    struct RealizeLossGlobalParams {
        address upperHint;
        address lowerHint;
        ExternalRebalanceParams collVaultToNectParams;
    }

    struct RealizeLossParams {
        address upperHint;
        address lowerHint;
        uint256 withdrawalEpoch;
        ExternalRebalanceParams collVaultToNectParams;
    }

    /// @dev Avoid stack too deep
    struct OnFlashLoanParams {
        uint256 maxCollWithdrawnWithPremium;
        uint256 nectCompensation;
        RealizeLossGlobalParams params;
    }

    struct ExternalRebalanceParams {
        address swapper;
        bytes payload;
        uint256 minRebalanceOut;
    }

    struct RebalanceParams {
        address sentCurrency;
        uint256 sentAmount;
        address receivedCurrency;
        ExternalRebalanceParams ext;
    }

    struct CollDebt {
        uint256 collVaultSharesToWithdraw;
        uint256 debtToUnwind;
        uint256 prevICR;
    }

    error ZeroAddress();
    error NotOwner(address sender);
    error TotalAssetsDeviation();
    error NotSupportedMethod();
    error AlreadyReported();
    error NotReported();
    error AmountZero();
    error AlreadyOpened();
    error EpochTooLate(uint256 epoch, uint256 maxEpoch);
    error EpochTooEarly(uint256 epoch, uint256 currTs, uint256 cutOffTs);
    error CancelTooLate();
    error InvalidExposureToken();
    error SameCurrency(address sent, address received);
    error BadDebt(uint256 amountInUsd);
    error BelowThreshold(uint256 sentValue, uint256 receivedValue);
    error SurpassedPrecision(uint256 precision);
    error BelowCR();
    error GettersWrongAddress();
    error NoProfit(int256 profit);
    error NoLoss();
    error LossNotRealized();
    error LossAlreadyRealized();
    error ExceededMaxRedeem(address receiver, uint256 expected, uint256 actual);
    error NotNect(address caller);
    error PositionOutOfTargetCR(uint256 currentICR, uint256 targetICR);
    error VaultSlippage(uint256 expected, uint256 actual);
    error SurpassedTotalShares(uint256 requested, uint256 totalShares);
    error SurpassedAvailableDebt(uint256 requested, uint256 available);
    error SwapperNotWhitelisted(address swapper);
    error LossTooSmall();
    error NotBoyco(address sender);

    event WithdrawalRequested(address indexed user, uint256 shares, uint256 epoch);
    event WithdrawalIntentCanceled(address indexed user, address receiver, uint256 epoch, uint256 shares);
    event EpochExecuted(uint256 indexed epoch, uint256 totalShares, uint256 wrappedAssetsWithdrawnRequested);
    event WithdrawalProcessed(address indexed user, address indexed receiver, uint256 epoch, uint256 shares, uint256 assets);
    event ProfitRealized(uint256 profitInExposure, uint256 sentAmount, uint256 coll);
    event LossRealized(uint256 totalShares, uint256 valueLoss,  uint256 collLoss);
    event LossForEpochRealized(uint256 indexed epoch, uint256 totalShares, uint256 collLoss, uint256 epochCollLoss);
    event ParametersUpdated(VaultParameters params);
    event SwapperWhitelisted(address indexed swapper, bool whitelisted);
    event NewPairThreshold(address tokenIn, address tokenOut, uint16 threshold);
    event BoycoAuthorized(address boyco, bool authorized);


    // Core actions
    function deposit(uint256 assets, address receiver, AddCollParams calldata params) external returns (uint256 shares);
    function redeemIntent(uint256 shares, address receiver, address owner) external returns (uint256 assets);
    function cancelWithdrawalIntent(uint256 epoch, uint256 sharesToCancel, address receiver) external;
    function executeWithdrawalEpoch(ExecuteWithdrawalParams calldata params) external;
    function withdrawFromEpoch(uint256 epoch, address receiver, ExternalRebalanceParams calldata unwrapParams) external;

    function increaseLeverage(
        uint256 maxFeePercentage,
        uint256 debtAmount,
        address upperHint,
        address lowerHint,
        ExternalRebalanceParams calldata params
    ) external returns (uint256 exposure);

    function decreaseLeverage(
        uint256 exposureAmount,
        address upperHint,
        address lowerHint,
        ExternalRebalanceParams calldata exposureToNectParams
    ) external returns (uint256 debt);

    function realizeProfit(
        uint16 profitsPercentageInBP,
        ExternalRebalanceParams calldata exposureToCollParams,
        address upperHint,
        address lowerHint
    ) external;

    function realizeLoss(uint16 lossPercentageInBP, RealizeLossGlobalParams calldata params) external;

    function realizeLossForEpoch(RealizeLossParams calldata params) external;

    function onFlashLoan(
        address initiator,
        address token,
        uint256 amount,
        uint256 fee,
        bytes calldata data
    ) external returns (bytes32);

    function openDen(
        uint256 maxFeePercentage,
        uint256 minCollVaultShares,
        address upperHint,
        address lowerHint,
        ExternalRebalanceParams calldata exposureToAssetParams
    ) external;

    // Configuration
    function setParameters(VaultParameters calldata params, uint256 prevTotalAssets) external;
    function setWhitelist(address swapper, bool whitelisted) external;
    function setPairThreshold(address _tokenIn, address _tokenOut, uint16 _thresholdInBP) external;

    // View getters
    function totalAssets() external view returns (uint256);
    function getCollVaultBalance() external view returns (uint256);
    function getCollateralValue() external view returns (uint256);
    function getExposureBalance() external view returns (uint256);
    function getDebtBalance() external view returns (uint256);
    function getTargetICR() external view returns (uint256);
    function getWithdrawalRequestEpoch(uint256 timestamp) external view returns (uint256);
    function getPrice(address token) external view returns (uint256);

    function previewDeposit(uint256 assets) external view returns (uint256 shares);
    function previewRedeem(uint256 shares) external view returns (uint256 assets);

    // Storage getters
    function extSloads(bytes32[] calldata slots) external view returns (bytes32[] memory res);
}