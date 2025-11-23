// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import "../interfaces/core/IHatsinCore.sol";

/**
    @title Hatsin Ownable
    @notice Contracts inheriting `HatsinOwnable` have the same owner as `HatsinCore`.
            The ownership cannot be independently modified or renounced.
    @dev In the contracts that use HATSIN_CORE to interact with protocol instance specific parameters,
            the immutable will be instanced with HatsinCore.sol, eitherway, it will be MetaHatsinCore.sol
 */
contract HatsinOwnable {
    IHatsinCore public immutable HATSIN_CORE;

    constructor(address _hatsinCore) {
        HATSIN_CORE = IHatsinCore(_hatsinCore);
    }

    modifier onlyOwner() {
        require(msg.sender == HATSIN_CORE.owner(), "Only owner");
        _;
    }

    function owner() public view returns (address) {
        return HATSIN_CORE.owner();
    }

    function guardian() public view returns (address) {
        return HATSIN_CORE.guardian();
    }
}
