// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {IMetaHatsinCore} from "src/interfaces/core/IMetaHatsinCore.sol";

/**
 * @title CollateralVaultRegistry
 * @author Hatsin Team
 * @notice Registry to help track both CollateralVaults that can mint NECT, as well as those who can't and are just auto-compounding 
 * @dev Excludes Boyco CollateralVaults
 */
contract CollateralVaultRegistry {
    struct Vault {
        address vault;
        /// @dev Block number when the vault was deployed
        uint blockNumber;
        // Which instance the vault is at:
        // - 0 -> Only auto-compounding (not collateral)
        // - n -> Collateral vault for protocol instance n 
        uint8 protocolInstance; 
    }

    IMetaHatsinCore public immutable metaHatsinCore;

    Vault[] public collateralVaults;
    mapping(address => bool) public isCollateralVault;
    mapping(address => uint) private vaultIndex;
    mapping(address => bool) public isOwner;

    error OnlyOwner(address caller);
    error NotCollateralVault(address vault);
    error DuplicateVault(address vault);

    event NewCollateralVault(address indexed vault, uint blockNumber, uint8 protocolInstance);
    event VaultModified(address indexed vault, uint blockNumber, uint8 protocolInstance);
    event NewOwner(address);
    event RemovedOwner(address);

    modifier onlyOwner() {
        if (msg.sender != metaHatsinCore.owner() && !isOwner[msg.sender])
            revert OnlyOwner(msg.sender);
        _;
    }

    constructor(address _metaHatsinCore, address _initialOwner) {
        metaHatsinCore = IMetaHatsinCore(_metaHatsinCore);
        isOwner[_initialOwner] = true;
    }

    function setCollateralVaults(Vault[] calldata _collVaults) external onlyOwner {
        for (uint i; i < _collVaults.length; i++) {
            Vault memory _collVault = _collVaults[i];

            if (IERC4626(_collVault.vault).asset() == address(0))
                revert NotCollateralVault(_collVault.vault);
            if (isCollateralVault[_collVault.vault])
                revert DuplicateVault(_collVault.vault);

            vaultIndex[_collVault.vault] = collateralVaults.length;
            collateralVaults.push(_collVault);
            isCollateralVault[_collVault.vault] = true;

            emit NewCollateralVault(_collVault.vault, _collVault.blockNumber, _collVault.protocolInstance);
        }
    }

    function modifyCollateralVault(Vault calldata _collVault) external onlyOwner {
        address vault = _collVault.vault;

        if (!isCollateralVault[vault])
            revert NotCollateralVault(vault);

        uint index = vaultIndex[vault];
        collateralVaults[index].blockNumber = _collVault.blockNumber;
        collateralVaults[index].protocolInstance = _collVault.protocolInstance;

        emit VaultModified(vault, _collVault.blockNumber, _collVault.protocolInstance);
    }

    function removeCollateralVault(address _collVault) external onlyOwner {
        if (!isCollateralVault[_collVault])
            revert NotCollateralVault(_collVault);

        uint index = vaultIndex[_collVault];
        uint lastIndex = collateralVaults.length - 1;

        if (index != lastIndex) {
            Vault memory lastVault = collateralVaults[lastIndex];
            collateralVaults[index] = lastVault;
            vaultIndex[lastVault.vault] = index;
        }

        collateralVaults.pop();
        delete isCollateralVault[_collVault];
        delete vaultIndex[_collVault];
    }

    function whitelistOwner(address _owner, bool whitelisted) external {
        if (msg.sender != metaHatsinCore.owner()) revert OnlyOwner(msg.sender);

        isOwner[_owner] = whitelisted;

        if (whitelisted) {
            emit NewOwner(_owner);
        } else {
            emit RemovedOwner(_owner);
        }
    }

    function getCollateralVaults() external view returns (Vault[] memory) {
        return collateralVaults;
    }
}