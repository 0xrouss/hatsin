// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";

interface IBHONEY is IERC4626 {
    function shareToAssetsPrice() external view returns (uint256);
}