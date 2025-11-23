// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IHatsinCore} from "src/interfaces/core/IHatsinCore.sol";
import {IMetaHatsinCore} from "src/interfaces/core/IMetaHatsinCore.sol";
import {IFactory} from "src/interfaces/core/IFactory.sol";
import {IDenManager} from "src/interfaces/core/IDenManager.sol";

/**
    @title Hatsin Core
    @notice Single source of truth for protocol-wide values and contract ownership.
            Other ownable Hatsin contracts inherit their ownership from this contract
            using `HatsinOwnable`.
    @dev Offers specific per protocol instance beacon variables such as startTime, CCR, dmBootstrapPeriod.
 */
contract HatsinCore is IHatsinCore {
    // System-wide start time, rounded down the nearest epoch week.
    // Other contracts that require access to this should inherit `SystemStart`.
    uint256 public immutable startTime;

    IMetaHatsinCore public immutable metaHatsinCore;

    uint256 public CCR; 

    // During bootstrap period collateral redemptions are not allowed in LSP
    mapping(address => uint64) internal _dmBootstrapPeriod;

    // Beacon-looked at by inherited DelegatedOps
    mapping(address peripheryContract => bool) public isPeriphery;

    constructor(address _metaHatsinCore, uint256 _initialCCR) {
        if (_metaHatsinCore == address(0)) {
            revert("HatsinCore: 0 address");
        }
        metaHatsinCore = IMetaHatsinCore(_metaHatsinCore);
        startTime = (block.timestamp / 1 weeks) * 1 weeks;
        CCR = _initialCCR;

        emit CCRSet(_initialCCR);
    }

    modifier onlyOwner() {
        require(msg.sender == metaHatsinCore.owner(), "Only owner");
        _;
    }

    function setPeripheryEnabled(address _periphery, bool _enabled) external onlyOwner {
        isPeriphery[_periphery] = _enabled;
        emit PeripheryEnabled(_periphery, _enabled);
    }

    /// @notice Bootstrap period is added to denManager deployed timestamp
    function setDMBootstrapPeriod(address denManager, uint64 _bootstrapPeriod) external onlyOwner {
        _dmBootstrapPeriod[denManager] = _bootstrapPeriod;

        emit DMBootstrapPeriodSet(denManager, _bootstrapPeriod);
    }

    /**
     * @notice Updates the Critical Collateral Ratio (CCR) to a new value
     * @dev Only callable by the contract owner
     * @dev Values lower than current CCR will be notified by public comms and called through a timelock
     * @param newCCR The new Critical Collateral Ratio value to set
     * @custom:emits CCRSet 
     */
    function setNewCCR(uint newCCR) external onlyOwner {
        require(newCCR > 0, "Invalid CCR");        
        CCR = newCCR;
        emit CCRSet(newCCR);
    }

    /// @notice Enables each DenManager to set their own redemptions bootstrap period
    /// @dev Specific for DenManager fetches
    function dmBootstrapPeriod() external view returns (uint64) {
        return _dmBootstrapPeriod[msg.sender];
    }

    function priceFeed() external view returns (address) {
        return metaHatsinCore.priceFeed();
    }

    function owner() external view returns (address) {
        return metaHatsinCore.owner();
    }

    function pendingOwner() external view returns (address) {
        return metaHatsinCore.pendingOwner();
    }

    function guardian() external view returns (address) {
        return metaHatsinCore.guardian();
    }

    function manager() external view returns (address) {
        return metaHatsinCore.manager();
    }

    function feeReceiver() external view returns (address) {
        return metaHatsinCore.feeReceiver();
    }

    function paused() external view returns (bool) {
        return metaHatsinCore.paused();
    }

    function lspBootstrapPeriod() external view returns (uint64) {
        return metaHatsinCore.lspBootstrapPeriod();
    }

    function getLspEntryFee(address rebalancer) external view returns (uint16) {
        return metaHatsinCore.getLspEntryFee(rebalancer);
    }

    function getLspExitFee(address rebalancer) external view returns (uint16) {
        return metaHatsinCore.getLspExitFee(rebalancer);
    }

    function getPeripheryFlashLoanFee(address peripheryContract) external view returns (uint16) {
        return metaHatsinCore.getPeripheryFlashLoanFee(peripheryContract);
    }
}