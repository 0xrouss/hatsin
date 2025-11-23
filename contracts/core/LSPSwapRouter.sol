// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {ILiquidStabilityPool} from "src/interfaces/core/ILiquidStabilityPool.sol";
import {ILiquidStabilityPoolGetters} from "src/interfaces/core/helpers/ILSPGetters.sol";
import {SafeERC20, IERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IAsset} from "src/interfaces/utils/tokens/IAsset.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";


contract LSPSwapRouter  {
    using SafeERC20 for IERC20;

    ILiquidStabilityPool public immutable liquidStabilityPool;
    ILiquidStabilityPoolGetters public immutable liquidStabilityPoolGetters;
    address public immutable nect;

    constructor(address _liquidStabilityPool, address _liquidStabilityPoolGetters) {
        liquidStabilityPool = ILiquidStabilityPool(_liquidStabilityPool);
        liquidStabilityPoolGetters = ILiquidStabilityPoolGetters(_liquidStabilityPoolGetters);
        nect = liquidStabilityPool.asset();
    }

    function swap(address tokenIn, address tokenOut, uint256 amountIn) external {
        _validateTokens(tokenIn, tokenOut);

        if(tokenIn == liquidStabilityPool.asset()) {
            _swapNectToStable(tokenOut, amountIn);
        } else {
            _swapStableToNect(tokenIn, amountIn);
        }
    }

    function _swapNectToStable(address tokenOut, uint256 amountIn) internal {
        IERC20(nect).safeTransferFrom(msg.sender, address(this), amountIn);
    
        // Deposit NECT (already in 18 decimals)
        // Returns shares based on the 18-decimal amount
        uint sharesReceived = liquidStabilityPool.deposit(amountIn, address(this));

        address[] memory preferredTokens = buildPreferredTokens(tokenOut);

        uint256 balanceBefore = IERC20(tokenOut).balanceOf(msg.sender);
        // Redeem shares - previewRedeem internally returns assets in 18 decimals (NECT decimals)
        // The redeem function handles the conversion from shares to 18-decimal assets internally
        liquidStabilityPool.redeem(sharesReceived, preferredTokens, msg.sender, address(this));
        uint256 balanceAfter = IERC20(tokenOut).balanceOf(msg.sender);
        uint256 amountOut = balanceAfter - balanceBefore;

        // Ensure we received tokens
        // Note: The LSP handles decimal conversion internally, rounding down in favor of the pool
        // This is correct for pool safety, but may result in slight rounding differences
        require(amountOut > 0, "LSPSwapRouter: no tokens received");
    }

    function _swapStableToNect(address tokenIn, uint256 amountIn) internal {

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        IERC20(tokenIn).safeApprove(address(liquidStabilityPool), amountIn);

        // Deposit the token (LSP converts to 18 decimals internally if tokenIn != NECT)
        // Returns shares based on the 18-decimal equivalent value
        uint256 shares = liquidStabilityPool.deposit(
            amountIn,
            address(this),
            tokenIn
        );

        // Build preferred tokens with NECT first in accepted stables section
        // Note: The LSP will try to fulfill redemption with tokens in order
        // If other tokens (collaterals, extra assets, accepted stables) have balances,
        // they will be used first. This means if the pool has enough of those tokens,
        // no NECT will be returned. We need to ensure the pool has NECT available.
        address[] memory preferredTokens = buildPreferredTokens(nect);
        
        uint256 nectarBalancebefore = IERC20(nect).balanceOf(address(this));

        // Redeem shares - previewRedeem internally returns assets in 18 decimals (NECT decimals)
        // The redeem function handles the conversion from shares to 18-decimal assets internally
        liquidStabilityPool.redeem(shares, preferredTokens, address(this), address(this));

        uint256 nectarBalanceAfter = IERC20(nect).balanceOf(address(this)) - nectarBalancebefore;

        // Ensure we received NECT
        // Note: The LSP handles decimal conversion internally, rounding down in favor of the pool
        // This is correct for pool safety, but may result in slight rounding differences
        // If no NECT was received, it means the redemption was fulfilled with other tokens
        // This can happen if the pool has collaterals/extra assets/accepted stables with balances
        require(nectarBalanceAfter > 0, "LSPSwapRouter: no nectar received - pool may not have NECT available or redemption was fulfilled with other tokens");
        
        IERC20(nect).safeTransfer(msg.sender, nectarBalanceAfter);
    }

    function buildPreferredTokens(address tokenOut)
        public
        view
        returns (address[] memory preferredUnderlyingTokens)
    {
        address[] memory collateralTokens = liquidStabilityPool.getCollateralTokens();
        address[] memory extraAssets = liquidStabilityPoolGetters.extraAssets();
        address[] memory acceptedStables = liquidStabilityPool.getAcceptedStables();
        uint uniqueStablesLength = liquidStabilityPool.getAcceptedStablesUniqueLength();

        // Use uniqueStablesLength to avoid counting tokens that are both collateral and accepted stable twice
        preferredUnderlyingTokens = new address[](collateralTokens.length + extraAssets.length + uniqueStablesLength + 1);

        uint256 i;
        for (; i < collateralTokens.length; i++) {
            preferredUnderlyingTokens[i] = collateralTokens[i];
        }
        
        for (uint256 j = 0; j < extraAssets.length; j++) {
            preferredUnderlyingTokens[i + j] = extraAssets[j];
        }
        i += extraAssets.length;

        uint256 stableIndex = 0;
        
        // Handle the case where tokenOut is nect
        if (tokenOut == address(nect)) {
            // When swapping TO NECT, prioritize NECT first in the accepted stables section
            // This ensures NECT is tried before other accepted stables during redemption
            preferredUnderlyingTokens[i + stableIndex] = address(nect);
            stableIndex++;
            
            // Then add other unique accepted stables (exclude those that are also collaterals)
            // We have uniqueStablesLength slots total for accepted stables (including NECT)
            for (uint256 j = 0; j < acceptedStables.length && stableIndex < uniqueStablesLength; j++) {
                // Check if this accepted stable is also a collateral
                bool isCollateral = false;
                for (uint256 k = 0; k < collateralTokens.length; k++) {
                    if (collateralTokens[k] == acceptedStables[j]) {
                        isCollateral = true;
                        break;
                    }
                }
                
                // Only add if it's not a collateral (to avoid duplicates)
                if (!isCollateral) {
                    preferredUnderlyingTokens[i + stableIndex] = acceptedStables[j];
                    stableIndex++;
                }
            }
        } else {
            // Original logic for when tokenOut is not nect
            // First, check if tokenOut is a collateral
            bool tokenOutIsCollateral = false;
            for (uint256 k = 0; k < collateralTokens.length; k++) {
                if (collateralTokens[k] == tokenOut) {
                    tokenOutIsCollateral = true;
                    break;
                }
            }
            
            // Add tokenOut if it's an accepted stable and not a collateral
            bool tokenOutAdded = false;
            if (!tokenOutIsCollateral) {
                for (uint256 j = 0; j < acceptedStables.length; j++) {
                    if (acceptedStables[j] == tokenOut) {
                        preferredUnderlyingTokens[i + stableIndex] = tokenOut;
                        stableIndex++;
                        tokenOutAdded = true;
                        break;
                    }
                }
            }
            
            // Then add other unique accepted stables (excluding tokenOut and collaterals)
            // We have uniqueStablesLength slots for accepted stables total (including tokenOut if added), then 1 slot for NECT
            // If tokenOut was added, we have uniqueStablesLength - 1 slots left for other stables
            // If tokenOut was not added (it's a collateral or not an accepted stable), we have uniqueStablesLength slots for other stables
            uint256 maxStablesToAdd = uniqueStablesLength;
            if (tokenOutAdded) {
                maxStablesToAdd = uniqueStablesLength - 1; // tokenOut already counted
            }
            
            for (uint256 j = 0; j < acceptedStables.length && stableIndex < maxStablesToAdd; j++) {
                if (acceptedStables[j] == tokenOut) continue;
                
                // Check if this accepted stable is also a collateral
                bool isCollateral = false;
                for (uint256 k = 0; k < collateralTokens.length; k++) {
                    if (collateralTokens[k] == acceptedStables[j]) {
                        isCollateral = true;
                        break;
                    }
                }
                
                // Only add if it's not a collateral (to avoid duplicates)
                if (!isCollateral) {
                    preferredUnderlyingTokens[i + stableIndex] = acceptedStables[j];
                    stableIndex++;
                }
            }
            
            preferredUnderlyingTokens[i + stableIndex] = address(nect);
        }
    }

    function _isTokenAccepted(address token) internal view returns (bool) {
        address[] memory acceptedStables = liquidStabilityPool.getAcceptedStables();
        for (uint i = 0; i < acceptedStables.length; i++) {
            if (acceptedStables[i] == token) {
                return true;
            }
        }
        return false;
    }

    /// @dev Checks if tokenIn or tokenOut is nect or an accepted stable, otherwise reverts.
    function _validateTokens(address tokenIn, address tokenOut) internal view {

        bool tokenInIsNect = (tokenIn == nect);
        bool tokenInIsAcceptedStable = _isTokenAccepted(tokenIn);

        bool tokenOutIsNect = (tokenOut == nect);
        bool tokenOutIsAcceptedStable = _isTokenAccepted(tokenOut);

        if (
            !(tokenInIsNect || tokenInIsAcceptedStable) &&
            !(tokenOutIsNect || tokenOutIsAcceptedStable)
        ) {
            revert("LSPSwapRouter: tokenIn and tokenOut must be nect or accepted stable");
        }

        if(tokenIn == tokenOut) {
            revert("LSPSwapRouter: tokenIn and tokenOut cannot be the same");
        }
    }
}
