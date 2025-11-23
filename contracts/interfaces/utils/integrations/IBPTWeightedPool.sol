// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

interface IBPTWeightedPool {
    function getPoolId() external view returns (bytes32);
    function totalSupply() external view returns (uint256);
    function getActualSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
    function getInvariant() external view returns (uint256);
    function getNormalizedWeights() external view returns (uint256[] memory);
}