
// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IKodiakIsland} from "src/interfaces/utils/tokens/IKodiakIsland.sol";

interface IKodiakIslandWithRouter is IKodiakIsland {
    function getAvgPrice(uint32) external view returns (uint160 avgSqrtPriceX96);
}