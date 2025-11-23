// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import "../interfaces/core/IHatsinCore.sol";

/**
    @title Hatsin System Start Time
    @dev Provides a unified `startTime` and `getWeek`, used for emissions.
 */
contract SystemStart {
    uint256 immutable startTime;

    constructor(address hatsinCore) {
        startTime = IHatsinCore(hatsinCore).startTime();
    }

    function getWeek() public view returns (uint256 week) {
        return (block.timestamp - startTime) / 1 weeks;
    }
}
