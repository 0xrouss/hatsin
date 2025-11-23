// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IBaseCollateralVault} from "./IBaseCollateralVault.sol";
interface ICollateralVault {
    function initialize(IBaseCollateralVault.BaseInitParams calldata baseParams) external;
}