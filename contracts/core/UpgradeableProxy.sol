// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.26;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/**
 * @title Upgradeable Proxy
 * @author Hatsin
 * @dev UUPS proxy
 */
contract UpgradeableProxy is ERC1967Proxy {
    /**
     * @dev Initializes the upgradeable proxy with an initial implementation specified by `_logic`.
     *
     * If `_data` is nonempty, it's used as data in a delegate call to `_logic`. This will typically be an encoded
     * function call, and allows initializing the storage of the proxy like a Solidity constructor.
     */
    constructor(address _logic, bytes memory _data) payable ERC1967Proxy(_logic, _data) {}

    function getCurrentImplementation() public view returns (address) {
        return _implementation();
    }
}
