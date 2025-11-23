pragma solidity ^0.8.26;

interface IAsset {}

interface IBexVault {

    enum UserBalanceOpKind {
        DEPOSIT_INTERNAL,
        WITHDRAW_INTERNAL,
        TRANSFER_INTERNAL,
        TRANSFER_EXTERNAL
    }

    struct UserBalanceOp {
        UserBalanceOpKind kind;
        IAsset asset;
        uint256 amount;
        address sender;
        address payable recipient;
    }

    enum JoinKind {
        INIT,
        EXACT_TOKENS_IN_FOR_LP_OUT,
        TOKEN_IN_FOR_EXACT_LP_OUT,
        ALL_TOKENS_IN_FOR_EXACT_LP_OUT
    }

    struct JoinPoolRequest {
        address[] assets;
        uint256[] maxAmountsIn;
        bytes userData;
        bool fromInternalBalance;
    }

    function joinPool(
        bytes32 poolId,
        address sender,
        address recipient,
        JoinPoolRequest memory request
    ) external;

    function getPoolTokens(bytes32 poolId)
        external
        view
    returns (address[] memory tokens, uint256[] memory balances, uint256 lastChangeBlock);

    function manageUserBalance(UserBalanceOp[] memory ops) external payable;
}

// used to get poolId to then add liquidity 
interface IBexPool {
    function getPoolId() external view returns (bytes32);

}