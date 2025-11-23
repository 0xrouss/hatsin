// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IHatsinCore} from "../interfaces/core/IHatsinCore.sol";

/**
    @title Hatsin Delegated Operations
    @notice Allows delegation to specific contract functionality. Useful for creating
            wrapper contracts to bundle multiple interactions into a single call.

            Functions that supports delegation should include an `account` input allowing
            the delegated caller to indicate who they are calling on behalf of. In executing
            the call, all internal state updates should be applied for `account` and all
            value transfers should occur to or from the caller.

            For example: a delegated call to `openDen` should transfer collateral
            from the caller, create the debt position for `account`, and send newly
            minted tokens to the caller.
 */
contract DelegatedOps {
    IHatsinCore immutable hatsinCore;

    mapping(address owner => mapping(address caller => bool isApproved)) public isApprovedDelegate;

    event DelegateApprovalSet(address indexed owner, address indexed delegate, bool isApproved);

    constructor(address _hatsinCore) {
        if (_hatsinCore == address(0)) {
            revert("DelegatedOps: 0 address");
        }
        hatsinCore = IHatsinCore(_hatsinCore);
    }

    modifier callerOrDelegated(address _account) {
        require(msg.sender == _account || hatsinCore.isPeriphery(msg.sender) || isApprovedDelegate[_account][msg.sender], "Delegate not approved");
        _;
    }

    function setDelegateApproval(address _delegate, bool _isApproved) external {
        isApprovedDelegate[msg.sender][_delegate] = _isApproved;
        emit DelegateApprovalSet(msg.sender, _delegate, _isApproved);
    }
}
