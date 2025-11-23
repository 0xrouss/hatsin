// SPDX-License-Identifier: MIT

pragma solidity 0.8.26;

import {IFeeHook} from "src/interfaces/utils/integrations/IFeeHook.sol";

// NOTES this fee hook is applied to lsp deposit - redeem when msg.sender is lspSwapRouter
// if we follow the approach of user set fees here we will ideally real the sortedPositions 
// and fill the swaps with this "orderbook" like approach 
// for now it will have fixed fees 
contract LspSwapperFeeHook is IFeeHook {

    constructor() {}

    function calcFee(address caller, address stable, uint256 amount, Action action)
        external
        view
        returns (uint256 feeInBP)
    {
        if (action == Action.DEPOSIT || action == Action.MINT) {
            return 3; // 3 BP deposit fee
        }

        return 2; // 2 BP redeem fee
    }

}