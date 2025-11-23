// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IBPTStablePool {
    function getPoolId() external view returns (bytes32);
    function totalSupply() external view returns (uint256);
    function getActualSupply() external view returns (uint256);
    function decimals() external view returns (uint8);
    function getTokenRate(address token) external view returns (uint256);
    function getRate() external view returns (uint256);
}