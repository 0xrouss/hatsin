// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IERC3156FlashBorrower} from "@openzeppelin/contracts/interfaces/IERC3156FlashBorrower.sol";
import {IDenManager} from "./../core/IDenManager.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IDeleverageRouter is IERC3156FlashBorrower {
    struct DenParams {
        uint256 collVaultAmount;
        address upperHint;
        address lowerHint;
    }

    struct RedeemToOnePartialParams {
        uint256 minTargetTokenAmount;
        uint256 collAmountToSwap;
        address swapRouter;
        bytes[] swapCalldatas;
    }

    struct DenLoopingParams {
        uint256 debtToRepay;
        uint256 nectProvidedByUser;
        DenParams denParams;
        RedeemToOnePartialParams collVaultParams;
    }

    error NotOwner(address sender);
    error NotNect(address caller);
    error ZeroAddress();
    error FlashLoanFailed();
    error BeraTransferFailed();
    error InsufficientNectReceived(uint256 nectReceived, uint256 minNectAmount);
    error InsufficientDebtToClose(uint256 provided, uint256 actual);
    error NoDenToClose();
    error NoNeedToLoop();

    event DeleverageRepayDebt(
        address indexed denManager,
        address indexed account,
        uint256 collAmountWithdrawn, // in collateral vault denominated amount
        uint256 nectReceived, // after collVault to NECT swap
        uint256 debtAmount
    );

    event DeleverageCloseDen(
        address indexed denManager,
        address indexed account,
        uint256 collAmountWithdrawn, // in collateral vault denominated amount
        uint256 collAmountToSwap, // in collateral vault denominated amount, if parameter overriden, can be less than collAmountWithdrawn
        uint256 nectReceived, // after collVault to NECT swap
        uint256 debtAmount
    );

    /// @dev Allows the user to repay debt for den position using flashloan, if internal swap has positive slippage, sends extra NECT to the user
    /// @dev Ensure it leaves minNetDebt, margin slippage check is done in the NECT approval step
    function automaticLoopingRepayDebt(IDenManager denManager, DenLoopingParams calldata denLoopingParams) external;

    /// @dev Allows the user to close a den position using flashloan, if internal swap has positive slippage, sends extra NECT or collateral to the user
    /// @dev Margin slippage check is done in the NECT approval step
    function closeDen(IDenManager denManager, DenLoopingParams calldata closeDenWithFlashLoanParams) external;

    /// @dev Allows owner to claim any remaining tokens, including Bera, stored in the router contract.
    function claimLockedTokens(IERC20[] calldata tokens, uint256[] calldata amounts) external;
}
