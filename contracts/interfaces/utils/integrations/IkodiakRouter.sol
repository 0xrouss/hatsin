import {IKodiakIsland} from "src/interfaces/utils/tokens/IKodiakIsland.sol";

interface IKodiakRouter {
    function addLiquidity(
        IKodiakIsland island,     // Address of the Kodiak Island
        uint256 amount0Max,       // Maximum amount of token0 willing to deposit
        uint256 amount1Max,       // Maximum amount of token1 willing to deposit
        uint256 amount0Min,       // Minimum acceptable token0 deposit (slippage protection)
        uint256 amount1Min,       // Minimum acceptable token1 deposit (slippage protection)
        uint256 amountSharesMin,  // Minimum IslandTokens to receive
        address receiver          // Address to receive LP tokens
    ) external returns (
        uint256 amount0,         // Actual token0 amount deposited
        uint256 amount1,         // Actual token1 amount deposited
        uint256 mintAmount       // LP tokens received
    );
}