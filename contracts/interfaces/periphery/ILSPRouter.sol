// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

interface ILSPRouter {
    struct RedeemToOneParams {
        uint shares;
        uint minAssetsWithdrawn;
        address targetToken;
        address receiver;
        address caller;
        bytes[] tokensSwapCalldatas;
        uint minTargetTokenAmount;
        address swapRouter;
    }

    struct RedeemPreferredUnderlyingParams {
        uint shares;
        address[] preferredUnderlyingTokens;
        address receiver;
        address caller;
        uint minAssetsWithdrawn;
        bool unwrap;
    }

    struct RedeemPreferredUnderlyingToOneParams {
        uint shares;
        address[] preferredUnderlyingTokens;
        address swapRouter;
        address receiver;
        address caller;
        address targetToken;
        uint minAssetsWithdrawn;
        bytes[] tokensSwapCalldatas;
        uint minTargetTokenAmount;
    }

    struct RedeemWithoutPrederredUnderlyingParams {
        uint shares;
        address receiver;
        address caller;
        uint minAssetsWithdrawn;
        bool unwrap;
    }

    struct WithdrawFromLSPParams {
        uint assets;
        address receiver;
        address caller;
        uint maxSharesWithdrawn;
        bool unwrap;     
    }

    struct Arr {
        uint[] prevAmounts;
        address receiver;
    }

    struct UnwrapSwapToOneParams {
        address[] tokens;
        address[] tokensToClaim;
        Arr arr;
        address targetToken;
        address receiver;
        uint minTargetTokenAmount;
        address swapRouter;
        bytes[] tokensSwapCalldatas;
        uint[] underlyingCurrAmounts;
    }

    struct SwapAllTokensToOneParams {
        address receiver;
        address swapRouter;
        bytes[] tokensSwapCalldatas;
        uint minTargetTokenAmount;
    }

    struct DepositTokenParams {
        address inputToken;
        uint inputAmount; 
        uint minSharesReceived;  
        address receiver;   
        address swapRouter;
        bytes dexCalldata;
    }

    error TokenPreviewMismatch(uint idx, address token, address expectedToken);

    function redeemPreferredUnderlying(
        RedeemPreferredUnderlyingParams calldata p
    ) external returns (uint assets, address[] memory tokens, uint[] memory amounts);

    function redeemPreferredUnderlyingToOne(
        RedeemPreferredUnderlyingToOneParams calldata params
    ) external returns (uint assets, uint totalAmountOut);

    function redeem(
        RedeemWithoutPrederredUnderlyingParams calldata params
    ) external returns (uint assets, address[] memory tokens, uint[] memory amounts);

    function withdraw(
        WithdrawFromLSPParams calldata params
    ) external returns (uint shares, address[] memory tokens, uint[] memory amounts);

    function deposit(
        DepositTokenParams calldata params
    ) external payable returns (uint shares);

    function previewRedeemPreferredUnderlying(uint shares, address[] calldata preferredUnderlyingTokens, address caller, bool unwrap) external view returns (uint assets, address[] memory tokens, uint[] memory amounts);

    function previewRedeem(uint shares, address caller) external view returns (uint assets, address[] memory tokens, uint[] memory amounts);

    function redeemToOne(
        RedeemToOneParams calldata params
    ) external returns (uint assets, uint totalAmountOut);
}