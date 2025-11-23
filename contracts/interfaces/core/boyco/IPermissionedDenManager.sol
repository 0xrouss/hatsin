// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IDenManager} from "../IDenManager.sol";

/**
    @title Hatsin Permissioned Den Manager Interface
    @notice Interface for PermissionedDenManager contract that limits only one arbitrary account to be opened
    @dev Used by boyco incentivized PSMBond.sol
 */
interface IPermissionedDenManager is IDenManager {
    function setPermissionedParameters(address _permissionedDen, address _protocolDen) external;
    /**
     * @notice Gets the address of the permissioned den
     * @return The permissioned den address
     */
    function permissionedDen() external view returns (address);

    /**
     * @notice Gets the address of the protocol den
     * @dev Enables liquidations to go through for the permissioned den, since a minimum of 2 dens are required
     * It is set at a higher CR than the permissioned den
     * @return The permissioned den address
     */
    function protocolDen() external view returns (address);

    /**
     * @dev Has to be set just after PermissionedDenManager is deployed via the Factory
     * @param _permissionedDen Address of the permissioned den, probably PSMBond
     */
    function setPermissionedDen(address _permissionedDen) external;

    /**
     * @notice To enable liquidations on permissioned den (BoycoVault), since a minimum of 2 dens are required
     * @dev Has a higher CR than the permissioned den
     * @param _protocolDen Address of the protocol den, apart from BoycoVault
     */
    function setProtocolDen(address _protocolDen) external;
}
