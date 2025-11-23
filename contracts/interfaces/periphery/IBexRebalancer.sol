// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IBexRebalancer {
    struct SwapPayload {
        bytes[] pathDefinitions;
        uint256 minUnderlyingAmount;
        uint256[] outputQuotes;
        uint256[] outputMins;
        address executor;
        uint32 referralCode;
    }
} 