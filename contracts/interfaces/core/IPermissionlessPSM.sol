// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IMetaHatsinCore} from "src/interfaces/core/IMetaHatsinCore.sol";
import {IDebtToken} from "src/interfaces/core/IDebtToken.sol";
import {IFeeHook} from "src/interfaces/utils/integrations/IFeeHook.sol";

interface IPermissionlessPSM {
    // Constants
    function DEFAULT_FEE() external view returns (uint16);

    // Public state variables (getter functions)
    function metaHatsinCore() external view returns (IMetaHatsinCore);
    function nect() external view returns (IDebtToken);
    function feeHook() external view returns (IFeeHook);
    function feeReceiver() external view returns (address);
    function paused() external view returns (bool);
    function nectMinted(address stable) external view returns (uint);
    function mintCap(address stable) external view returns (uint);
    function stables(address stable) external view returns (uint64);

    // Core functions
    function deposit(
        address stable,
        uint stableAmount,
        address receiver,
        uint16 maxFeePercentage
    ) external returns (uint mintedNect);

    function mint(
        address stable,
        uint nectAmount,
        address receiver,
        uint16 maxFeePercentage
    ) external returns (uint stableAmount);

    function withdraw(
        address stable,
        uint stableAmount,
        address receiver,
        uint16 maxFeePercentage
    ) external returns (uint burnedNect);

    function redeem(
        address stable,
        uint nectAmount,
        address receiver,
        uint16 maxFeePercentage
    ) external returns (uint stableAmount);

    // Preview functions
    function previewDeposit(
        address stable,
        uint stableAmount,
        uint16 maxFeePercentage
    ) external view returns (uint mintedNect, uint nectFee);

    function previewMint(
        address stable,
        uint nectAmount,
        uint16 maxFeePercentage
    ) external view returns (uint stableAmount, uint nectFee);

    function previewWithdraw(
        address stable,
        uint stableAmount,
        uint16 maxFeePercentage
    ) external view returns (uint burnedNect, uint stableFee);

    function previewRedeem(
        address stable,
        uint nectAmount,
        uint16 maxFeePercentage
    ) external view returns (uint stableAmount, uint stableFee);

    // Administrative functions
    function whitelistStable(address _stable) external;
    function blacklistStable(address _stable) external;
    function setFeeHook(address _feeHook) external;
    function setPaused(bool _paused) external;
    function setMintCap(address stable, uint _mintCap) external;
    function setFeeReceiver(address _feeReceiver) external;

    // Events
    event NectMinted(uint nectMinted, address stable);
    event NectBurned(uint nectBurned, address stable);
    event FeeHookSet(address feeHook);
    event PausedSet(bool paused);
    event MintCap(uint mintCap);
    event Deposit(
        address indexed caller,
        address indexed stable,
        uint stableAmount,
        uint mintedNect,
        uint fee
    );
    event Withdraw(
        address indexed caller,
        address indexed stable,
        uint stableAmount,
        uint burnedNect,
        uint fee
    );
}
