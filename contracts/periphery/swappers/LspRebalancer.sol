// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IMetaHatsinCore} from "src/interfaces/core/IMetaHatsinCore.sol";
import {ILSPRouter} from "src/interfaces/periphery/ILSPRouter.sol";
import {IDebtToken} from "src/interfaces/core/IDebtToken.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ILiquidStabilityPool} from "src/interfaces/core/ILiquidStabilityPool.sol";
import {ILiquidStabilityPoolGetters} from "src/interfaces/core/helpers/ILSPGetters.sol";
import {IOBRouter} from "src/interfaces/utils/integrations/IOBRouter.sol";

/// @title LSPRebalancer
/// @notice A contract that rebalances the Liquid Stability Pool by converting NECT to underlying assets
/// @dev This contract allows rebalancing of the LSP when NECT weight exceeds a threshold

// TODO: Actualize calldata to work with agnostic swapper
/*
contract LSPRebalancer {
    using SafeERC20 for IERC20;

    address lspGetters;
    ILSPRouter public lspRouter;
    IMetaHatsinCore public immutable META_BB_CORE;
    IERC20 public immutable NECT;
    IERC20 public immutable SNECT;
    
    uint256 public minRebalanceInterval = 1 minutes;
    uint256 public nectWeightThreshold = 0.999999999999999e18; // 99.9% in 1e18 format
    uint256 constant WAD = 1e18;
    address public keeper;
    uint256 public lastRebalanceTimestamp;
    uint public slippageThreshold = 9800; // in BP

    event KeeperUpdated(address indexed newKeeper);
    event Rebalanced(uint256 depositAmount, uint256 redeemedAmount);
    event NectWithdrawn(uint256 amount);
    event MinRebalanceIntervalUpdated(uint256 oldInterval, uint256 newInterval);
    event NectWeightThresholdUpdated(uint256 oldThreshold, uint256 newThreshold);

    struct RebalanceParams {
        address swapRouter;
        bytes[] tokensSwapCalldatas;
    }

    modifier onlyOwner() {
        require(msg.sender == META_BB_CORE.owner(), "LSPRebalancer: not owner");
        _;
    }

    modifier onlyOwnerOrKeeper() {
        require(msg.sender == META_BB_CORE.owner() || msg.sender == keeper, "LSPRebalancer: not owner or keeper");
        _;
    }

    modifier canRebalance() {
        require(block.timestamp - lastRebalanceTimestamp >= minRebalanceInterval, "LSPRebalancer: not enough time elapsed");
        _;
    }

    constructor(address _metaBbCore, address _lspRouter, address _sNect, address _lspGetters, address _keeper) {
        require(_metaBbCore != address(0) && _lspRouter != address(0) && _sNect != address(0) && _lspGetters != address(0), "LSPRebalancer: zero address");

        lspRouter = ILSPRouter(_lspRouter);
        META_BB_CORE = IMetaHatsinCore(_metaBbCore);
        NECT = IDebtToken(ILiquidStabilityPool(_sNect).asset());
        SNECT = IERC20(_sNect);
        lspGetters = _lspGetters;

        if(_keeper != address(0)) {
            keeper = _keeper;
            emit KeeperUpdated(_keeper);
        }
    }

    function shouldRebalance() public view returns (bool) {
        if (block.timestamp - lastRebalanceTimestamp < minRebalanceInterval) return false;
        
        uint256 nectBalance = NECT.balanceOf(address(SNECT));
        uint256 totalSupply = SNECT.totalSupply();
        
        if (totalSupply == 0) return false;
        
        uint256 nectWeight = (nectBalance * WAD) / totalSupply;
        
        // If nectWeight > WAD, it means there's an accounting issue or the pool is imbalanced
        // In this case, we definitely want to rebalance
        if (nectWeight > WAD) return true;
        
        // Otherwise, check against the threshold as normal
        return nectWeight < nectWeightThreshold;
    }

    function rebalance(
        uint256 depositAmount,
        RebalanceParams calldata params
    ) external onlyOwnerOrKeeper canRebalance {
        require(shouldRebalance(), "LSPRebalancer: rebalance not needed");
        require(NECT.balanceOf(address(this)) >= depositAmount, "LSPRebalancer: insufficient NECT balance");

        NECT.approve(address(lspRouter), depositAmount);

        ILSPRouter.DepositTokenParams memory depositParams = ILSPRouter.DepositTokenParams({
            inputToken: address(NECT),
            inputAmount: depositAmount,
            minSharesReceived: 1,
            receiver: address(this),
            dexCalldata: abi.encodeWithSelector(IOBRouter.swap.selector, 0, 0, 0, 0),
            swapRouter: params.swapRouter
        });

        uint sNectBalance = lspRouter.deposit(depositParams);
        
        require(sNectBalance > 0, "LSPRebalancer: no sNECT received");

        SNECT.approve(address(lspRouter), sNectBalance);

        address[] memory preferredUnderlyingTokens = buildPreferredTokens();
        (uint redeemedTokensLength, ,) = getRedeemedTokensLength(sNectBalance, preferredUnderlyingTokens);

        ILSPRouter.RedeemPreferredUnderlyingToOneParams memory redeemParams = ILSPRouter.RedeemPreferredUnderlyingToOneParams({
            shares: sNectBalance,
            preferredUnderlyingTokens: preferredUnderlyingTokens,
            swapRouter: params.swapRouter,
            receiver: address(this),
            targetToken: address(NECT),
            minAssetsWithdrawn: 1,
            tokensSwapCalldatas: params.tokensSwapCalldatas,
            minUnderlyingWithdrawn: new uint256[](preferredUnderlyingTokens.length),
            minTargetTokenAmount: depositAmount * slippageThreshold / 10000,
            redeemedTokensLength: uint8(redeemedTokensLength)
        });
    
        (uint256 nectReceived, ) = lspRouter.redeemPreferredUnderlyingToOne(redeemParams);
        
        lastRebalanceTimestamp = block.timestamp;
        
        emit Rebalanced(depositAmount, nectReceived);
    }

    function withdrawNect() external onlyOwner {
        uint256 nectBalance = NECT.balanceOf(address(this));
        require(nectBalance > 0, "LSPRebalancer: no NECT to withdraw");
        
        NECT.safeTransfer(msg.sender, nectBalance);
        
        emit NectWithdrawn(nectBalance);
    }


    function setKeeper(address _keeper) external onlyOwner {
        keeper = _keeper;
        emit KeeperUpdated(_keeper);
    }

    function setMinRebalanceInterval(uint256 _minRebalanceInterval) external onlyOwner {
        uint256 oldInterval = minRebalanceInterval;
        minRebalanceInterval = _minRebalanceInterval;
        emit MinRebalanceIntervalUpdated(oldInterval, _minRebalanceInterval);
    }

    function setSlippageThreshold(uint256 _newSlippageThreshold) external onlyOwner {
        require(_newSlippageThreshold <= 10_000);
        slippageThreshold = _newSlippageThreshold;

    }
    function getRedeemedTokensLength(uint sentAmount, address[] memory preferredUnderlyingTokens) public view returns(
        uint256 redeemedTokensLength,
        address[] memory tokens,
        uint[] memory amounts
    ) {
        (, tokens, amounts) = lspRouter.previewRedeemPreferredUnderlying(sentAmount, preferredUnderlyingTokens, true);
        
        // Filter out tokens with amount 0
        uint256 nonZeroCount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] > 0) {
                nonZeroCount++;
            }
        }

        address[] memory filteredTokens = new address[](nonZeroCount);
        uint[] memory filteredAmounts = new uint[](nonZeroCount);
        uint256 index = 0;

        for (uint256 i = 0; i < amounts.length; i++) {
            if (amounts[i] > 0) {
                filteredTokens[index] = tokens[i];
                filteredAmounts[index] = amounts[i];
                index++;
            }
        }

        tokens = filteredTokens;
        amounts = filteredAmounts;
        redeemedTokensLength = tokens.length;
    }


    function buildPreferredTokens()
        public
        view
        returns (address[] memory preferredUnderlyingTokens)
    {
        address[] memory collateralTokens = ILiquidStabilityPool(address(SNECT)).getCollateralTokens();
        address[] memory extraAssets = ILiquidStabilityPoolGetters(lspGetters).extraAssets();
        preferredUnderlyingTokens = new address[](collateralTokens.length + extraAssets.length + 1);

        uint256 i;
        for (; i < collateralTokens.length; i++) {
            preferredUnderlyingTokens[i] = collateralTokens[i];
        }
        for (uint256 j = 0; j < extraAssets.length; j++) {
            preferredUnderlyingTokens[i + j] = extraAssets[j];
        }
        preferredUnderlyingTokens[i + extraAssets.length] = address(NECT);
    }

    function setNectWeightThreshold(uint256 _nectWeightThreshold) external onlyOwner {
        require(_nectWeightThreshold <= 1e18, "LSPRebalancer: threshold must be <= 100%");
        uint256 oldThreshold = nectWeightThreshold;
        nectWeightThreshold = _nectWeightThreshold;
        emit NectWeightThresholdUpdated(oldThreshold, _nectWeightThreshold);
    }
}
*/