// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {ERC4626Upgradeable, ERC20Upgradeable, IERC20, Math, SafeERC20} from "@openzeppelin-upgradeable/contracts/token/ERC20/extensions/ERC4626Upgradeable.sol";
import {EnumerableSet} from "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import {UUPSUpgradeable} from "@openzeppelin-upgradeable/contracts/proxy/utils/UUPSUpgradeable.sol";
import {SafeCast} from "@openzeppelin/contracts/utils/math/SafeCast.sol";
import {PriceLib} from "../libraries/PriceLib.sol";
import {TokenValidationLib} from "../libraries/TokenValidationLib.sol";
import {EmissionsLib} from "../libraries/EmissionsLib.sol";
import {FeeLib} from "../libraries/FeeLib.sol";
import {HatsinMath} from "../dependencies/HatsinMath.sol";
import {ILiquidStabilityPool} from "../interfaces/core/ILiquidStabilityPool.sol";
import {IPriceFeed} from "../interfaces/core/IPriceFeed.sol";
import {IDebtToken} from "../interfaces/core/IDebtToken.sol";
import {IHatsinCore} from "../interfaces/core/IHatsinCore.sol";
import {IRebalancer} from "../interfaces/utils/integrations/IRebalancer.sol";
import {IAsset} from "../interfaces/utils/tokens/IAsset.sol";
import {IFeeHook} from "src/interfaces/utils/integrations/IFeeHook.sol";


/**
    @title Hatsin Stability Pool
    @notice Based on Liquity's `StabilityPool`
            https://github.com/liquity/dev/blob/main/packages/contracts/contracts/StabilityPool.sol

            Hatsin's implementation is modified to support multiple collaterals. Deposits into
            the liquid stability pool may be used to liquidate any supported collateral type.
 */
// TODO add minNect and acceptedStables caps 
contract LiquidStabilityPool is ERC4626Upgradeable, UUPSUpgradeable {
    using Math for uint;
    using SafeERC20 for IERC20;
    using EnumerableSet for EnumerableSet.AddressSet;
    using PriceLib for uint;
    using TokenValidationLib for address;
    using TokenValidationLib for address[];
    using EmissionsLib for EmissionsLib.BalanceData;
    using EmissionsLib for EmissionsLib.EmissionSchedule;
    using SafeCast for uint;
    using FeeLib for uint;

    uint constant WAD = 1e18;
    uint constant BP = 1e4;

    // keccak256(abi.encode(uint(keccak256("openzeppelin.storage.LiquidStabilityPool")) - 1)) & ~bytes32(uint(0xff))
    bytes32 private constant LiquidStabilityPoolStorageLocation = 0x3c2bbd5b01c023780ac7877400fd851b17fd98c152afdb1efc02015acd68a300;

    function _getLSPStorage() internal pure returns (ILiquidStabilityPool.LSPStorage storage store) {
        assembly {
            store.slot := LiquidStabilityPoolStorageLocation
        }
    }

    event AssetsWithdraw(
        address indexed receiver,
        uint shares,
        address[] tokens,
        uint[] amounts
    );
    event ExtraAssetAdded(address token);
    event ExtraAssetRemoved(address token);
    event AcceptedStableAdded(address token);
    event AcceptedStableRemoved(address token);
    event ProtocolRegistered(
        address indexed factory,
        address indexed liquidationManager
    );
    event ProtocolBlacklisted(address indexed factoryRemoved, address indexed LMremoved);
    event Offset(address collateral, uint debtToOffset, uint collToAdd, uint collSurplusAmount);
    event Rebalance(address indexed sentCurrency, address indexed receivedCurrency, uint sentAmount, uint receivedAmount, uint sentValue, uint receivedValue);

    error AddressZero();
    error NoPriceFeed();
    error OnlyOwner();
    error TokenNotAccepted();
    error TokenCannotBeNect();
    error TokenCannotBeExtraAsset();
    error CallerNotFactory();
    error ExistingCollateral();
    error BalanceRemaining();
    error Paused();
    error BootstrapPeriod();
    error InvalidArrayLength();
    error LastTokenMustBeNect();
    error CallerNotLM();
    error SameTokens();
    error BelowThreshold();
    error ZeroTotalSupply();
    error TokenMustBeExtraAsset();
    error TokenIsVesting();
    error InvalidThreshold();
    error FactoryAlreadyRegistered();
    error LMAlreadyRegistered();
    error FactoryNotRegistered();
    error InsufficientNectReserves();
    error LMNotRegistered();
    error WithdrawingLockedEmissions();
    error LastTokensMustBeAcceptedStables();
    error NoFeeHook();

    constructor() {
        _disableInitializers();
    }

    function initialize(ILiquidStabilityPool.InitParams calldata params) initializer external {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        if (address(params._metaHatsinCore) == address(0) || params._liquidationManager == address(0) || params._factory == address(0)) {
            revert AddressZero();
        }
        
        $.metaHatsinCore = params._metaHatsinCore;
        $.feeReceiver = params._feeReceiver;
        $.defaultUnlockRatePerSec = params._defaultUnlockRatePerSecond;

        _registerProtocol(
            $,
            address(params._liquidationManager),
            address(params._factory)
        );

        IPriceFeed priceFeed = IPriceFeed(params._metaHatsinCore.priceFeed());
        if (priceFeed.fetchPrice(address(params._asset)) == 0) revert NoPriceFeed();

        __ERC20_init(params._sharesName, params._sharesSymbol);
        __ERC4626_init(params._asset);
    }

    modifier onlyOwner {
        _onlyOwner();
        _;
    }

    modifier whenNotBootstrapPeriod() {
        _whenNotBootstrapPeriod();
        _;
    }

    function _onlyOwner() private view {
        // Owner is beacon variable MetaHatsinCore::owner()
        if (msg.sender != _getLSPStorage().metaHatsinCore.owner()) revert OnlyOwner();
    }

    modifier onlyOwnerOrManager {
        _onlyOwnerOrManager();
        _;
    }

    function _onlyOwnerOrManager() private view {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();
        address owner = $.metaHatsinCore.owner();
        address manager = $.metaHatsinCore.manager();
        if (msg.sender != owner && msg.sender != manager) revert OnlyOwner();
    }

    function _whenNotBootstrapPeriod() internal view {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();
        if (block.timestamp < $.metaHatsinCore.lspBootstrapPeriod()) revert BootstrapPeriod();
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    function enableCollateral(address _collateral, uint64 _unlockRatePerSecond, bool forceThroughBalanceCheck) external {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        if (_collateral == asset()) revert TokenCannotBeNect();
        if (!$.factoryProtocol[msg.sender]) revert CallerNotFactory();
        if ($.extraAssets.contains(_collateral)) revert TokenCannotBeExtraAsset();

        if ($.acceptedStables.contains(_collateral)) {
            $.uniqueAcceptedStables--;
        }

        uint length = $.collateralTokens.length;
        bool collateralEnabled;

        $.balanceData.setUnlockRatePerSecond(_collateral, _unlockRatePerSecond);
        for (uint i; i < length; i++) {
            if ($.collateralTokens[i] == _collateral) {
                collateralEnabled = true;
                break;
            }
        }

        if (!collateralEnabled) {
            $.collateralTokens.push(_collateral);
            $.indexByCollateral[_collateral] = $.collateralTokens.length;
        } else {
            revert ExistingCollateral();
        }
    }


    /** @dev See {IERC4626-totalAssets}. */
    /// @dev AmountInNect is scaled to 18 decimals, since its NECT decimals
    /// @dev Substracts balances locked emissions
    function totalAssets() public view override returns (uint amountInNect) {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        uint amountInUsd;
        address[] memory collaterals = getCollateralTokens();
        uint nectPrice = getPrice(asset());

        uint collateralsLength = collaterals.length;
        uint extraAssetsLength = $.extraAssets.length();

        // For NECT, we use the full balance (including locked emissions from swap fees)
        // Locked fees are still part of the pool's value and contribute to share price
        // They just unlock over time for withdrawal, creating APR for depositors
        // assumes NECT is 18 decimals
        uint nectBalance = $.balanceData.balance[asset()];

        address[] memory acceptedStables = $.acceptedStables.values();
        for (uint i; i < acceptedStables.length; i++) {
            address token = acceptedStables[i];
            uint balance = $.balanceData.balanceOf(token);

            if (balance > 0) {
                amountInUsd += balance.convertToValue(getPrice(token), IAsset(token).decimals());
            }
        }

        for (uint i; i < collateralsLength; i++) {
            address collateral = collaterals[i];
            
            if ($.acceptedStables.contains(collateral)) {
                continue;
            }
            
            uint balance = $.balanceData.balanceOf(collateral);
            if (balance > 0) {
                amountInUsd += balance.convertToValue(getPrice(collateral), IAsset(collateral).decimals());
            }
        }

        for (uint i; i < extraAssetsLength; i++) {
            address token = $.extraAssets.at(i);
            uint balance = $.balanceData.balanceOf(token);

            if (balance > 0) {
                amountInUsd += balance.convertToValue(getPrice(token), IAsset(token).decimals());
            }
        }

        amountInNect = amountInUsd * WAD / nectPrice + nectBalance;
    }

    function getPrice(
        address token
    ) public view returns (uint scaledPriceInUsdWad) {
        IPriceFeed priceFeed = IPriceFeed(_getLSPStorage().metaHatsinCore.priceFeed());
        return priceFeed.fetchPrice(token);
    }

    // Note - TODO: when swaps will be executed check for msg.sender = swapRouter
    // to apply custom swap fees too asset pair, default to normal lsp fee when not 
    // invoked by lspSwapRouter
    function deposit(
        uint assets,
        address receiver,
        address inputToken
    ) public returns (uint shares) {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        if ($.metaHatsinCore.paused()) revert Paused();

        // Only allow asset (NECT) deposits during bootstrap period
        // Accepted stables can only be deposited after bootstrap period
        uint originalAmount = assets;
        if (inputToken != asset()) {
            _whenNotBootstrapPeriod();
            if (!$.acceptedStables.contains(inputToken)) {
                revert TokenNotAccepted();
            }          
            assets = assets.convertToValue(getPrice(inputToken), IAsset(inputToken).decimals());
        }

        (uint rawShares, uint feeShares) = _previewDeposit(assets);
        shares = rawShares - feeShares;

        _depositAndMint($, shares, assets, receiver, inputToken, feeShares, originalAmount);
    }

    function deposit(
        uint assets,
        address receiver
    ) public override returns (uint shares) {
        return deposit(assets, receiver, asset());
    }

    function mint(
        uint shares,
        address receiver
    ) public override returns (uint assets) {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        if ($.metaHatsinCore.paused()) revert Paused();

        assets = previewMint(shares);

        uint fee = shares.mulDiv(BP, BP - _entryFeeBP(), Math.Rounding.Up) - shares;

        _depositAndMint($, shares, assets, receiver, asset(), fee, assets);
    }

    function _depositAndMint(ILiquidStabilityPool.LSPStorage storage $, uint shares, uint assets, address receiver, address inputToken, uint fee, uint originalAmount) private {
        // For NECT, use assets (already in correct decimals). For other tokens, use originalAmount (in token's decimals)
        uint amountToTransfer = inputToken == asset() ? assets : originalAmount;
        _provideFromAccount(msg.sender, amountToTransfer, inputToken);

        if (fee != 0) {
            // If fees come from LSPSwapRouter, add them to pool balance with vesting for depositors
            // Otherwise, mint to feeReceiver as before
            if (msg.sender == $.lspSwapper) {
                // Use totalSupply() before minting to get accurate fee conversion
                uint currentTotalSupply = totalSupply();
                _addSwapFeeToPool($, fee, currentTotalSupply);
            } else {
                _mint($.feeReceiver, fee);
            }
        }

        _mint(receiver, shares);

        //maybe we should emit the inputToken
        emit Deposit(msg.sender, receiver, assets, shares);
    }

    function withdraw(
        uint assets,
        address receiver,
        address _owner
    ) public whenNotBootstrapPeriod override returns (uint shares) {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();
            
        uint _totalSupply = totalSupply();

        uint maxAssets = maxWithdraw(_owner);
        if (assets > maxAssets) revert ERC4626ExceededMaxWithdraw(_owner, assets, maxAssets);

        shares = previewWithdraw(assets);

        (uint nectAmount, uint fee) = _burn($, shares, _totalSupply, _owner);

        _withdraw(nectAmount, receiver, shares - fee, _totalSupply, _owner, assets, shares);
    }

    function redeem(
        uint shares,
        address receiver,
        address _owner
    ) public whenNotBootstrapPeriod override returns (uint assets) {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        uint _totalSupply = totalSupply();

        uint maxShares = maxRedeem(_owner);
        if (shares > maxShares) revert ERC4626ExceededMaxRedeem(_owner, shares, maxShares);

        assets = previewRedeem(shares);

        (uint nectAmount, uint fee) = _burn($, shares, _totalSupply, _owner);

        _withdraw(nectAmount, receiver, shares - fee, _totalSupply, _owner, assets, shares);
    }

    function _withdraw(uint nectAmount, address receiver, uint cachedShares, uint _totalSupply, address _owner, uint assets, uint shares) private {
        _withdrawFromAccount(nectAmount, receiver);
        _withdrawCollAndExtraAssets(receiver, cachedShares, _totalSupply);

        emit Withdraw(msg.sender, receiver, _owner, assets, shares);
    }

    function withdraw(
        uint assets,
        address[] calldata preferredUnderlyingTokens,
        address receiver,
        address _owner
    ) public whenNotBootstrapPeriod returns (uint shares) {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        uint maxAssets = maxWithdraw(_owner);
        if (assets > maxAssets) revert ERC4626ExceededMaxWithdraw(_owner, assets, maxAssets);
        
        /// @dev should we have a check for assets == 0? its redundant but gas will be low
        shares = previewWithdraw(assets);

        // Pass totalSupply as 0 since we don't need to calculate `nectAmount`
        _burn($, shares, 0, _owner);

        _withdrawPreferredUnderlying($, assets, preferredUnderlyingTokens, receiver);

        emit Withdraw(msg.sender, receiver, _owner, assets, shares);
    }

    function redeem(
        uint shares,
        address[] calldata preferredUnderlyingTokens,
        address receiver,
        address _owner
    ) public whenNotBootstrapPeriod returns (uint assets) {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        uint maxShares = maxRedeem(_owner);
        if (shares > maxShares) revert ERC4626ExceededMaxRedeem(_owner, shares, maxShares);

        assets = previewRedeem(shares);

        // Pass totalSupply as 0 since we don't need to calculate `nectAmount`
        _burn($, shares, 0, _owner);

        _withdrawPreferredUnderlying($, assets, preferredUnderlyingTokens, receiver);

        emit Withdraw(msg.sender, receiver, _owner, assets, shares);
    }

    function _burn(ILiquidStabilityPool.LSPStorage storage $, uint shares, uint _totalSupply, address _owner) private returns (uint nectAmount, uint fee) {
        // For swap operations, calculate fees on asset value (not shares) for accuracy
        // This ensures fees match the expected BP (e.g., 2 BP on redeem = 2 BP of asset value)
        if (msg.sender == $.lspSwapper && _totalSupply != 0) {
            // Calculate asset value of shares being redeemed using totalAssets (matches share price)
            uint currentTotalAssets = totalAssets();
            uint assetValue = shares.mulDiv(currentTotalAssets, _totalSupply, Math.Rounding.Down);
            // Calculate fee on asset value (more accurate for swaps)
            uint feeInAssets = getOperationFeeOnAssets(msg.sender, asset(), assetValue, IFeeHook.Action.REDEEM);
            // Convert asset-based fee back to shares using totalAssets (consistent with share price)
            fee = feeInAssets.mulDiv(_totalSupply, currentTotalAssets, Math.Rounding.Up);
        } else {
            // For non-swap operations, use share-based fees (existing behavior)
            fee = getOperationFee(msg.sender, asset(), shares, IFeeHook.Action.REDEEM);
        }

        if (msg.sender != _owner) {
            _spendAllowance(_owner, msg.sender, shares);
        }

        /// @dev Always round in favor of the vault
        /// @dev Use balanceOf to account for locked emissions from swap fees
        if (_totalSupply != 0) {
            nectAmount = (shares - fee).mulDiv($.balanceData.balanceOf(asset()), _totalSupply, Math.Rounding.Down);
        }

        // We could remove fee > 0 if we deploy with fees and the minimum fee is not 0
        if (fee != 0) {
            // If fees come from LSPSwapRouter, add them to pool balance with vesting for depositors
            // Otherwise, mint to feeReceiver as before
            if (msg.sender == $.lspSwapper) {
                // Use totalSupply() before burning to get accurate fee conversion
                // If _totalSupply is 0 (from redeem), use totalSupply() instead
                uint currentTotalSupply = _totalSupply != 0 ? _totalSupply : totalSupply();
                _addSwapFeeToPool($, fee, currentTotalSupply);
            } else {
                _mint($.feeReceiver, fee);
            }
        }

        _burn(_owner, shares);
    }

    /// @dev No token validation is needed, if token is not collateral or extraAsset, it will underflow in `$balance[token]`
    /// @dev Reentrancy attack vector should not be possible since user has their shares burned before the calls to tokens
    /// @dev No duplicated token check needed
    function _withdrawPreferredUnderlying(
        ILiquidStabilityPool.LSPStorage storage $,
        uint assets,
        address[] memory preferredUnderlyingTokens,
        address receiver
    ) internal {
        // Avoid stack too deep error
        ILiquidStabilityPool.Arrays memory arr = _initArrays(preferredUnderlyingTokens);

        _validatePreferredUnderlyingTokens($, preferredUnderlyingTokens, arr.collateralsLength);
        preferredUnderlyingTokens.checkForDuplicates(arr.length);

        address nect = asset();
        uint remainingAssets = assets;
        uint nectPrice = getPrice(nect);

        for (uint i; i < arr.length && remainingAssets != 0; i++) {
            address token = preferredUnderlyingTokens[i];

            token.checkValidToken(arr.collaterals, arr.collateralsLength, nect, $.extraAssets.contains(token) || $.acceptedStables.contains(token));

            uint unlockedBalance = $.balanceData.balanceOf(token);
            if (unlockedBalance == 0) continue;
            uint tokenPrice = getPrice(token);
            // Price could be 0 if CollVault collateral or extraAsset is just added without atomical initial deposit
            // Would result in less assets withdrawn than expected
            if (tokenPrice == 0) continue;
            uint8 tokenDecimals = IAsset(token).decimals();

            uint amount = remainingAssets.convertAssetsToCollAmount(
                tokenPrice,
                nectPrice,
                decimals(), // NECT decimals
                tokenDecimals,
                Math.Rounding.Down
            );

            if (unlockedBalance >= amount) {
                remainingAssets = 0;
            } else {
                uint remainingColl = amount - unlockedBalance;
                remainingAssets = remainingColl.convertCollAmountToAssets(
                    tokenPrice,
                    nectPrice,
                    decimals(), // NECT decimals
                    tokenDecimals
                );
                amount = unlockedBalance;
            }
            
            // Check minNectReserves if withdrawing NECT (before subtracting balance)
            // We check the full balance (not just unlocked) since we subtract from balance[token]
            if (token == nect) {
                uint currentBalance = $.balanceData.balance[token];
                if (currentBalance - amount < $.minNectReserves) {
                    revert InsufficientNectReserves();
                }
            }
            
            $.balanceData.balance[token] -= amount;
            arr.amounts[i] = amount;
        }

        for (uint i; i < arr.length; i++) {
            if(arr.amounts[i] > 0) {
                IERC20(preferredUnderlyingTokens[i]).safeTransfer(receiver, arr.amounts[i]);
            }
        }

        emit AssetsWithdraw(receiver, assets, preferredUnderlyingTokens, arr.amounts);
    }

    function _provideFromAccount(
        address account,
        uint _amount,
        address inputToken
    ) internal {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        if (inputToken == asset()) {
            IDebtToken(inputToken).sendToSP(account, _amount);
        } else {
            IERC20(inputToken).safeTransferFrom(account, address(this), _amount);
        }

        // Store the actual token amount (not converted value) for balance tracking
        $.balanceData.balance[inputToken] += _amount;

    }

    function _withdrawFromAccount(
        uint _amount,
        address receiver
    ) internal {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        IDebtToken(asset()).returnFromPool(address(this), receiver, _amount);
        $.balanceData.balance[asset()] -= _amount;
    }

    /*
     * Cancels out the specified debt against the Debt contained in the Stability Pool (as far as possible)
     */
    function offset(
        address collateral,
        uint _debtToOffset,
        uint _collToAdd
    ) external virtual {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        if (!$.liquidationManagerProtocol[msg.sender]) revert CallerNotLM();   
        
        uint collPrice = getPrice(collateral);
        uint nectPrice = getPrice(asset());
        uint debtInCollateralAmount = _debtToOffset.convertAssetsToCollAmount(
            collPrice,
            nectPrice,
            decimals(),
            IAsset(collateral).decimals(),
            Math.Rounding.Up
        );

        // Unlikely case in which LM offsets more debt value than collateral
        uint collSurplusAmount;
        if (_collToAdd > debtInCollateralAmount) {
            collSurplusAmount = _collToAdd - debtInCollateralAmount;
        }

        if (collSurplusAmount > 0) {
            $.balanceData.addEmissions(address(collateral), collSurplusAmount.toUint128());
        }

        $.balanceData.balance[collateral] += _collToAdd - collSurplusAmount;
        // Cancel the liquidated Debt debt with the Debt in the stability pool
        $.balanceData.balance[asset()] -= _debtToOffset;

        emit Offset(collateral, _debtToOffset, _collToAdd, collSurplusAmount);
    }

    /**
     * @notice Withdraws as much collaterals awaiting conversion as shares being used for NECT withdrawal
     * @param receiver Address to receive the collaterals
     * @param shares Amount of shares being used for NECT withdrawal
     * @param _totalSupply Has shares added to total supply since they have just been burned
     */
    function _withdrawCollAndExtraAssets(
        address receiver,
        uint shares,
        uint _totalSupply
    ) internal {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        address[] memory collaterals = getCollateralTokens();
        uint collLength = collaterals.length;
        uint extraAssetsLength = $.extraAssets.length();

        uint[] memory amounts = new uint[](collLength + extraAssetsLength);
        address[] memory tokens = new address[](collLength + extraAssetsLength);

        for (uint i; i < collLength; i++) {
            uint balanceWithUnlockedEmissions = $.balanceData.balanceOf(collaterals[i]);
            amounts[i] = shares.mulDiv(balanceWithUnlockedEmissions, _totalSupply, Math.Rounding.Down);
            tokens[i] = collaterals[i];

            $.balanceData.balance[collaterals[i]] -= amounts[i];
        }

        for (uint i; i < extraAssetsLength; i++) {
            uint idx = i + collLength;
            address token = $.extraAssets.at(i);

            uint balanceWithUnlockedEmissions = $.balanceData.balanceOf(token);
            amounts[idx] = shares.mulDiv(balanceWithUnlockedEmissions, _totalSupply, Math.Rounding.Down);
            tokens[idx] = token;

            $.balanceData.balance[token] -= amounts[idx];
        }

        for (uint i; i < tokens.length; i++) {
            if (amounts[i] != 0) {
                IERC20(tokens[i]).safeTransfer(receiver, amounts[i]);
            }
        }

        emit AssetsWithdraw(receiver, shares, tokens, amounts);
    }

    /**
     * @dev Limited to tokens that are not collaterals or NECT
     * @param token Token to add to the extraAssets
     * @param _unlockRatePerSecond Unlock rate per second once the token is pulled to the LSP
     */
    function addNewExtraAsset(
        address token,
        uint64 _unlockRatePerSecond
    ) external onlyOwner {
        _addNewExtraAsset(token, _unlockRatePerSecond);
    }

    /**
     * @dev Internal function to add a new extra asset
     * @param token Token to add to the extraAssets
     * @param _unlockRatePerSecond Unlock rate per second once the token is pulled to the LSP
     */
    function _addNewExtraAsset(
        address token,
        uint64 _unlockRatePerSecond
    ) internal {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        address[] memory collaterals = getCollateralTokens();
        if (token == asset()) revert TokenCannotBeNect();

        uint enableCollateralLength = collaterals.length;
        for (uint i; i < enableCollateralLength; i++) {
            if (collaterals[i] == token) revert ExistingCollateral();
        }

        if (!$.extraAssets.add(token)) revert TokenCannotBeExtraAsset();
        IPriceFeed priceFeed = IPriceFeed($.metaHatsinCore.priceFeed());
        if (priceFeed.fetchPrice(token) == 0) revert NoPriceFeed();

        $.balanceData.setUnlockRatePerSecond(token, _unlockRatePerSecond);

        emit ExtraAssetAdded(token);
    }

    /*
     * @notice Params overwrites the current vesting for the token
     * @dev Adjust the unlockRatePerSecond if we want to keep the fullUnlockTimestamp
     */
    function linearVestingExtraAssets(address token, int amount, address recipient) external onlyOwner {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        if (totalSupply() == 0) revert ZeroTotalSupply(); // convertToShares will return 0 for 'assets < totalAssets'
        if (!$.extraAssets.contains(token)) revert TokenMustBeExtraAsset();

        if (amount > 0) {
            uint _amount = uint(amount);
            IERC20(token).safeTransferFrom(msg.sender, address(this), _amount);
            $.balanceData.addEmissions(token, _amount.toUint128());
        } else {
            uint _amount = uint(-amount);
            // Note, revert with underflow if amount > `lockedEmissions`
            $.balanceData.subEmissions(token, _amount.toUint128());
            IERC20(token).safeTransfer(recipient, _amount);
        }
    }

    function removeExtraAsset(address token) external onlyOwner {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        if ($.balanceData.balance[token] != 0) revert BalanceRemaining();
        if ($.balanceData.emissionSchedule[token].unlockTimestamp() >= block.timestamp) revert TokenIsVesting();
        if (!$.extraAssets.remove(token)) revert TokenMustBeExtraAsset();

        emit ExtraAssetRemoved(token);
    }

    /**
     * @notice Adds swap fees from LSPSwapRouter to the pool balance with vesting
     * @dev Converts fee shares to NECT assets and adds them to pool with unlock rate
     *      This creates APR for depositors while preventing arbitrage via vesting
     *      Note: NECT fees are added to balance and tracked in emissions schedule for vesting
     * @param $ The LSP storage reference
     * @param feeShares The fee amount in shares
     * @param totalSupply The current total supply of shares (for conversion)
     */
    function _addSwapFeeToPool(
        ILiquidStabilityPool.LSPStorage storage $,
        uint feeShares,
        uint totalSupply
    ) private {
        uint feeInNect;
        if (totalSupply != 0) {
            // Convert fee shares to NECT value
            // For swap operations, fees are calculated on asset value, then converted to shares
            // Here we convert back to NECT for adding to pool balance
            uint nectBalance = $.balanceData.balanceOf(asset());
            feeInNect = feeShares.mulDiv(nectBalance, totalSupply, Math.Rounding.Down);
        } else {
            return;
        }

        if (feeInNect == 0) return;

        // Ensure unlock rate is set for NECT if not already set
        // Note: NECT is the asset, so we use the default unlock rate
        if ($.balanceData.emissionSchedule[asset()].unlockRatePerSecond() == 0) {
            $.balanceData.setUnlockRatePerSecond(asset(), $.defaultUnlockRatePerSec);
        }

        // Add fees to pool balance with vesting using the default unlock rate
        // addEmissions automatically adds to balance[asset()] and tracks in emissions schedule
        // This makes fees available to depositors over time, creating APR while preventing arbitrage
        $.balanceData.addEmissions(asset(), feeInNect.toUint128());
    }

    function setPairThreshold(address tokenIn, address tokenOut, uint thresholdInBP) external onlyOwner {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        if (thresholdInBP > BP) revert InvalidThreshold();

        bytes32 hash = keccak256(abi.encodePacked(tokenIn, tokenOut));
        $.threshold[hash] = thresholdInBP;
    }

    function setDefaultUnlockRatePerSecond(uint64 _defaultUnlockRatePerSecond) external onlyOwner {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();
        $.defaultUnlockRatePerSec = _defaultUnlockRatePerSecond;
    }

    function setUnlockRatePerSecond(address token, uint64 _unlockRatePerSecond) external onlyOwner {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        $.balanceData.setUnlockRatePerSecond(token, _unlockRatePerSecond);
    }

    /**
     * @notice Set minimum NECT reserves required for liquidations
     * @dev Only owner or manager can call this function
     * @param _minNectReserves Minimum NECT reserves in wei (18 decimals)
     */
    function setMinNectReserves(uint _minNectReserves) external onlyOwnerOrManager {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();
        $.minNectReserves = _minNectReserves;
    }

    // Preview ERC4626 functions applying entry/exit fees
    function previewDeposit(uint assets) public view override returns (uint) {
        (uint rawShares, uint feeShares) = _previewDeposit(assets);
        return rawShares - feeShares;
    }

    function _previewDeposit(uint assets) internal view returns (uint rawShares, uint feeShares) {
        rawShares = super.previewDeposit(assets);
        // For swap operations, use asset-based fee calculation for accuracy
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();
        if (msg.sender == $.lspSwapper) {
            // Calculate fee on assets (more accurate for swaps)
            uint feeInAssets = getOperationFeeOnAssets(msg.sender, asset(), assets, IFeeHook.Action.DEPOSIT);
            // Convert asset-based fee to shares using totalAssets (not just NECT balance)
            // This ensures the conversion matches share price calculation
            uint currentTotalSupply = totalSupply();
            if (currentTotalSupply != 0) {
                uint currentTotalAssets = totalAssets();
                feeShares = feeInAssets.mulDiv(currentTotalSupply, currentTotalAssets, Math.Rounding.Up);
                // Cap feeShares to rawShares to prevent underflow
                if (feeShares > rawShares) {
                    feeShares = rawShares;
                }
            } else {
                feeShares = 0;
            }
        } else {
            // Calculate fee on rawShares for non-swap operations
            feeShares = getOperationFee(msg.sender, asset(), rawShares, IFeeHook.Action.DEPOSIT);
            // Cap feeShares to rawShares to prevent underflow
            if (feeShares > rawShares) {
                feeShares = rawShares;
            }
        }
    }

    function previewMint(uint netShares) public view override returns (uint) {
        uint totalShares = netShares.mulDiv(BP, BP - _entryFeeBP(), Math.Rounding.Up);
        return super.previewMint(totalShares);
    }

    function previewWithdraw(uint assets) public view override returns (uint) {
        uint netShares = super.previewWithdraw(assets);
        uint totalShares = netShares.mulDiv(BP, BP - _exitFeeBP(), Math.Rounding.Up);
        return totalShares;
    }

    function previewRedeem(uint shares) public view override returns (uint) {
        uint fee = getOperationFee(msg.sender, asset(), shares, IFeeHook.Action.REDEEM);
        return super.previewRedeem(shares - fee);
    }

    function getOperationFee(address caller, address stable, uint256 shares, IFeeHook.Action action) public view returns (uint256 fee) {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        uint feeInBp;
        if ($.feeHook == address(0)) revert NoFeeHook();

        if (caller == $.lspSwapper) {
            IFeeHook feeHook = IFeeHook($.feeHook);
            feeInBp = feeHook.calcFee(caller, stable, shares, action);
        } else {
            if (action == IFeeHook.Action.DEPOSIT || action == IFeeHook.Action.MINT) {
                feeInBp = _entryFeeBP();
            } else {
                feeInBp = _exitFeeBP();
            }
        }

        fee = shares.feeOnRaw(feeInBp);
    }

    /**
     * @dev Calculate fees on asset amount (not shares) for more accurate swap fee calculation
     * This ensures fees match expected BP when prices are 1:1
     */
    function getOperationFeeOnAssets(address caller, address stable, uint256 assets, IFeeHook.Action action) public view returns (uint256 fee) {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        uint feeInBp;
        if ($.feeHook == address(0)) revert NoFeeHook();

        if (caller == $.lspSwapper) {
            IFeeHook feeHook = IFeeHook($.feeHook);
            feeInBp = feeHook.calcFee(caller, stable, assets, action);
        } else {
            if (action == IFeeHook.Action.DEPOSIT || action == IFeeHook.Action.MINT) {
                feeInBp = _entryFeeBP();
            } else {
                feeInBp = _exitFeeBP();
            }
        }

        fee = assets.feeOnRaw(feeInBp);
    }

    /** @dev See {IERC4626-maxWithdraw}. */
    function maxWithdraw(address _owner) public view override returns (uint) {
        return previewRedeem(balanceOf(_owner));
    }

    // === Fee configuration ===
    
    /// @dev Rebalancer fee discounts will look to a forwarding contract similar to LSPRouter, but with access control
    function _entryFeeBP() internal view virtual returns (uint) {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        return $.metaHatsinCore.getLspEntryFee(msg.sender);
    }

    function _exitFeeBP() internal view virtual returns (uint) {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();

        return $.metaHatsinCore.getLspExitFee(msg.sender);
    }

    function _initArrays(address[] memory preferredUnderlyingTokens) private view returns (ILiquidStabilityPool.Arrays memory arr) {
        address[] memory collaterals = getCollateralTokens();
        uint length = preferredUnderlyingTokens.length;

        arr = ILiquidStabilityPool.Arrays({
            length: length,
            collaterals: collaterals,
            collateralsLength: collaterals.length,
            amounts: new uint[](length)
        });
    }

 
    function _registerProtocol(
        ILiquidStabilityPool.LSPStorage storage $,
        address _liquidationManager,
        address _factory
    ) internal {
        if ($.factoryProtocol[_factory]) revert FactoryAlreadyRegistered();
        if ($.liquidationManagerProtocol[_liquidationManager]) revert LMAlreadyRegistered();

        $.factoryProtocol[_factory] = true;
        $.liquidationManagerProtocol[_liquidationManager] = true;

        emit ProtocolRegistered(_factory, _liquidationManager);
    }

    /* STORAGE VIEW */

    function extSloads(bytes32[] calldata slots) external view returns (bytes32[] memory res) {
        uint nSlots = slots.length;

        res = new bytes32[](nSlots);

        for (uint i; i < nSlots;) {
            bytes32 slot = slots[i++];

            assembly ("memory-safe") {
                mstore(add(res, mul(i, 32)), sload(slot))
            }
        }
    }

    /// @dev Returns the locked emissions
    function getLockedEmissions(address token) public view returns (uint) {
        EmissionsLib.EmissionSchedule memory schedule = _getLSPStorage().balanceData.emissionSchedule[token];
        uint fullUnlockTimestamp = schedule.unlockTimestamp();

        return schedule.lockedEmissions(fullUnlockTimestamp);
    }

    /**
     * @notice NECT is not locked
     */
    function getTotalDebtTokenDeposits() external view returns (uint) {
        return _getLSPStorage().balanceData.balance[asset()];
    }

    /**
     * @dev Returns the list of collateral tokens
     */
    function getCollateralTokens() public view returns (address[] memory) {
        return _getLSPStorage().collateralTokens;
    }

    /**
     * @notice Returns the list of accepted stable tokens
     * @return Array of accepted stable token addresses
     */
    function getAcceptedStables() public view returns (address[] memory) {
        return _getLSPStorage().acceptedStables.values();
    }

    /**
     * @dev Add or remove a stable token from the accepted stables set
     * @param token Token to add or remove from the acceptedStables
     * @param add True to add the token, false to remove it
     */
    function setAcceptedStable(address token, bool add, uint64 _unlockRatePerSecond) external onlyOwner {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();
    
        if (token == asset()) revert TokenCannotBeNect();
        // allow to be a swappabe stable even if that token is a collateralToken
        // note this duplicity to account for the preferred tokens length 

        address[] memory collatTokens = getCollateralTokens();  
        bool isCollateral = false;
        for (uint i = 0; i < collatTokens.length; i++) {
            if (collatTokens[i] == token) {
                isCollateral = true;
                break;
            }
        }

        if (add) {     
            if (!isCollateral) {
                $.uniqueAcceptedStables++;
            }
            
            IPriceFeed priceFeed = IPriceFeed($.metaHatsinCore.priceFeed());
            if (priceFeed.fetchPrice(token) == 0) revert NoPriceFeed();

            if (!$.acceptedStables.add(token)) revert TokenCannotBeExtraAsset();

            $.balanceData.setUnlockRatePerSecond(token, _unlockRatePerSecond);
            emit AcceptedStableAdded(token);               
        } else {
            // this removal logic can be internalize for satbles and extra assets to reduce codeSize
            if ($.balanceData.balance[token] != 0) revert BalanceRemaining();
            if ($.balanceData.emissionSchedule[token].unlockTimestamp() >= block.timestamp) revert TokenIsVesting();
            if (!$.acceptedStables.remove(token)) revert TokenMustBeExtraAsset();

            if (!isCollateral) {
                $.uniqueAcceptedStables--;
            }

            emit AcceptedStableRemoved(token);
        }
    }

    function setFeeHook(address feeHook) external onlyOwner {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();
        $.feeHook = feeHook;
    }

    function setLspSwapper(address lspSwapper) external onlyOwner {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();
        $.lspSwapper = lspSwapper;
    }

    /**
     * @dev Internal function to validate preferred underlying tokens
     * @param $ The LSP storage reference
     * @param preferredUnderlyingTokens Array of preferred underlying tokens
     * @param collateralsLength Length of the array
     */
    function _validatePreferredUnderlyingTokens(
        ILiquidStabilityPool.LSPStorage storage $,
        address[] memory preferredUnderlyingTokens,
        uint collateralsLength
    ) internal view {
        // Use uniqueAcceptedStables to avoid counting tokens that are both collateral and accepted stable twice
        uint acceptedStablesLength = $.uniqueAcceptedStables;
        uint expectedLength = $.extraAssets.length() + collateralsLength + acceptedStablesLength + 1; // +1 for NECT
        
        if (preferredUnderlyingTokens.length != expectedLength) revert InvalidArrayLength();
        
        bool nectFound = false;
        uint acceptedStablesFound = 0;
        
        // Get collateral tokens to check for duplicates
        address[] memory collateralTokens = $.collateralTokens;
        
        for (uint i = preferredUnderlyingTokens.length - acceptedStablesLength - 1; i < preferredUnderlyingTokens.length; i++) {
            address token = preferredUnderlyingTokens[i];
            if (token == asset()) {
                nectFound = true;
            } else if ($.acceptedStables.contains(token)) {
                // Only count if it's not also a collateral (to match uniqueAcceptedStables logic)
                bool isCollateral = false;
                for (uint j = 0; j < collateralTokens.length; j++) {
                    if (collateralTokens[j] == token) {
                        isCollateral = true;
                        break;
                    }
                }
                if (!isCollateral) {
                    acceptedStablesFound++;
                }
            } else {
                revert LastTokensMustBeAcceptedStables();
            }
        }

        if (!nectFound || acceptedStablesFound != $.uniqueAcceptedStables) {
            revert LastTokensMustBeAcceptedStables();
        }
    }

    /**
     * @notice Returns the number of unique accepted stables.
     */
    function getAcceptedStablesUniqueLength() external view returns (uint256) {
        ILiquidStabilityPool.LSPStorage storage $ = _getLSPStorage();
        return $.uniqueAcceptedStables;
    }
}