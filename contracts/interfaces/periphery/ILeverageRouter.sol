// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IERC3156FlashBorrower} from "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";
import {IDenManager} from "./../core/IDenManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ILeverageRouter is IERC3156FlashBorrower {
    enum Action {
        OpenDen,
        IncreaseColl,
        RepayDebt
    }

    struct DenParams {
        uint256 maxFeePercentage;
        address upperHint;
        address lowerHint;
    }

    struct DexAggregatorParams {
        bytes dexCalldata;
        uint256 outputMin;
        address swapRouter;
    }

    struct DenLoopingParams {
        /// @dev the amount of nect token to be borrowed via flashloan
        uint256 flashloanNectAmount;
        /// @dev the amount of the underlying asset (of CollVault) to be swapped into Nectar tokens for repayment, along with debtAmount
        uint256 marginCollAmount;
        DenParams denParams;
        DexAggregatorParams nectToColl;
    }

    struct LeverageMemory {
        uint256 currentColl;
        uint256 currentDebt;
        uint256 collVaultPrice;
        uint256 prevICR;
        uint256 marginInCollVault;
        uint256 additionalCollateral;
    }

    error NotOwner(address sender);
    error NotNect(address caller);
    error ZeroCollateral();
    error ZeroAddress();
    error FlashLoanFailed();
    error InvalidDexSelector();
    error CollateralRatioBelowCCR();
    error CollateralRatioBelowMCR();
    error InsufficientAssetReceived(uint256 assetReceived, uint256 outputMin);
    error LeverageExceeded(uint256 leverage, uint256 maxLeverage);
    error DebtTooLow(uint256 debtAmount, uint256 minNetDebt);
    error BeraTransferFailed();
    error InsufficientPayBackAmount(uint256 nectBalance, uint256 payBackAmount);
    error PositionBelowMinimumCR(uint256 resultingCR, uint256 minimumCR);
    error RecoveryMode(uint256 newTCR, uint256 CCR);
    error PositionNotImprovedUnderRM(uint256 resultingICR, uint256 prevICR);

    event AutomaticLoopingOpenDen(
        address indexed denManager,
        address indexed borrower,
        uint256 marginCollAmount,
        uint256 finalCollAmount, // after swapping nect to collateral
        uint256 flashloanNectAmount
    );

    event AutomaticLoopingAddCollateral(
        address indexed denManager,
        address indexed borrower,
        uint256 marginCollAmount,
        uint256 finalCollAmount, // after swapping nect to collateral
        uint256 flashloanNectAmount
    );

    /**
     * @dev Opens a leveraged den position using flashloan, if internal swap has positive slippage, sends extra NECT to the user
     */
    function automaticLoopingOpenDen(IDenManager denManager, DenLoopingParams calldata denLoopingParams) external;

    /**
     * @dev Increases a den position by adding collateral using flashloan, if internal swap has positive slippage, sends extra NECT to the user
     */
    function automaticLoopingAddCollateral(IDenManager denManager, DenLoopingParams calldata denLoopingParams)
        external;

    /**
     * @dev Determines the proper amount of debt tokens that can be borrowed based on the provided margin,
     *      desired collateral ratio (CR), and leverage.
     * @param denManager the address of DenManager
     * @param position the address of Borrower
     * @param margin the asset amount to be used for the leveraged position, if the position is already opened, it can be 0
     * @param leverage the leverage factor, representing how much the position is amplified relative to the margin and current collateral
     *                 unit is in BP, where 20000 represents 2x leverage.
     * @param minimumCR collateral Ratio to be applied, will be validated against a threshold tolerance of 50bp
     * @param isRecoveryMode a boolean indicating whether the system is in recovery mode
     * @return debtAmount the calculated amount of debt tokens that will be needed to be borrowed
     */
    function calculateDebtAmount(
        IDenManager denManager,
        address position,
        uint256 margin,
        uint256 leverage,
        uint256 minimumCR,
        bool isRecoveryMode
    ) external view returns (uint256 debtAmount);

    /**
     * @dev Based on the minimum ICR a position wants to stay, calculates the maximum leverage that can be applied
     * @param currentColl Amount in Collateral Vault in the position
     * @param currentDebt  Amount in Debt in the position
     * @param margin  Amount of margin to be used for the leveraged position, in the Collateral Vault
     * @param price Dollar value of the collateral vault
     * @param minimumCR WAD precision, e.g. 120% = 1.2e18
     */
    function calculateMaxLeverage(
        uint256 currentColl,
        uint256 currentDebt,
        uint256 margin,
        uint256 price,
        uint256 minimumCR
    ) external pure returns (uint256 maxLeverage);

    /// @dev Allows owner to claim any remaining tokens, including Bera, stored in the router contract.
    function claimLockedTokens(IERC20[] calldata tokens, uint256[] calldata amounts) external;

    /// @dev Allows owner to add or remove a swap router from the whitelist.
    function addWhitelistedSwapper(address _swapRouter, bool status) external;
}
