// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ILiquidStabilityPool} from "../interfaces/core/ILiquidStabilityPool.sol";

library LSPLib {
    error FactoryAlreadyRegistered();
    error LMAlreadyRegistered();

    /**
     * @dev Initialize arrays for preferred underlying tokens withdrawal
     * @param preferredUnderlyingTokens Array of preferred underlying tokens
     * @param collaterals Array of collateral tokens
     * @return arr Initialized Arrays struct
     */
    function initArrays(
        address[] memory preferredUnderlyingTokens,
        address[] memory collaterals
    ) internal pure returns (ILiquidStabilityPool.Arrays memory arr) {
        arr = ILiquidStabilityPool.Arrays({
            length: preferredUnderlyingTokens.length,
            collaterals: collaterals,
            collateralsLength: collaterals.length,
            amounts: new uint[](preferredUnderlyingTokens.length)
        });
    }

    /**
     * @dev Register a protocol (factory and liquidation manager)
     * @param $ The LSP storage reference
     * @param _liquidationManager The liquidation manager address
     * @param _factory The factory address
     * @dev Note: The calling contract should emit ProtocolRegistered event after calling this
     */
    function registerProtocol(
        ILiquidStabilityPool.LSPStorage storage $,
        address _liquidationManager,
        address _factory
    ) internal {
        if ($.factoryProtocol[_factory]) revert FactoryAlreadyRegistered();
        if ($.liquidationManagerProtocol[_liquidationManager]) revert LMAlreadyRegistered();

        $.factoryProtocol[_factory] = true;
        $.liquidationManagerProtocol[_liquidationManager] = true;
    }
}

