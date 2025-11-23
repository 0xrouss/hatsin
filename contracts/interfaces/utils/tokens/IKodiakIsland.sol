// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

interface IKodiakIsland {
    function getUnderlyingBalancesAtPrice(uint160) external view returns (uint reserve0, uint reserve1);
    function token0() external view returns (address);
    function token1() external view returns (address);
    function totalSupply() external view returns (uint256);
    function pool() external view returns (address);
    function mint(
        uint256 mintAmount,
        address receiver
    )
        external
    returns (uint256 amount0, uint256 amount1, uint128 liquidityMinted);

    function getMintAmounts(
        uint256 amount0Max,
        uint256 amount1Max
    )
        external
        view
    returns (uint256 amount0, uint256 amount1, uint256 mintAmount);
    function getUnderlyingBalances()
        external
        view
    returns (uint256 amount0Current, uint256 amount1Current);
}