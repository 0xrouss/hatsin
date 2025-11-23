// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {BaseCollateralVault, IBaseCollateralVault} from "./BaseCollateralVault.sol";

contract CollateralVault is BaseCollateralVault { 
    function initialize(IBaseCollateralVault.BaseInitParams calldata baseParams) public initializer {
        __BaseCollateralVault_init(baseParams);
    }
}