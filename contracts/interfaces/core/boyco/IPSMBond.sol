// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IAsset} from "../../utils/tokens/IAsset.sol";
import {IDebtToken} from "../IDebtToken.sol";
import {IMetaHatsinCore} from "../IMetaHatsinCore.sol";

interface IPSMBond {
    struct InitParams {
        IMetaHatsinCore _metaHatsinCore;
        IAsset _stable;
        IDebtToken _nect;
        address _boycoRelayer;
    }

    error ZeroAddress();
    error NotOwner(address sender);
    error NotBoyco(address sender);
    error PausedDeposits();
    error PausedWithdrawals();
    error NoChange();

    // PROXY
    function upgradeTo(address newImplementation, bytes calldata data) external;
    function getCurrentAdmin() external view returns (address);
    function transferAdminRole(address newAdmin) external;
    function getCurrentImplementation() external view returns (address);

    function initialize(InitParams calldata params) external;
    function deposit(uint assets, address receiver) external returns (uint mintedShares);
    function setBoycoAuthorized(address boyco, bool authorized) external;
    function getNectMinted() external view returns (uint);
    function withdraw(uint shares, address receiver, address owner) external returns (uint assets);
    function setMetaHatsinCore(address _metaHatsinCore) external;
    function isBoycoAuthorized(address boyco) external view returns (bool);
    function stable() external view returns (IAsset);
}
