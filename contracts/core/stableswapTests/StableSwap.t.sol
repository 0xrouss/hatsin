import {Test, console2} from "forge-std/Test.sol";
import {LiquidStabilityPool} from "src/core/LiquidStabilityPool.sol";
import {LSPSwapRouter} from "src/periphery/LSPSwapRouter.sol";
import {BaseProxyTest, IERC20} from "test/BaseProxyTest.t.sol";
import {MockERC20} from "test/mocks/MockERC20.sol";
import {ILiquidStabilityPool} from "src/interfaces/core/ILiquidStabilityPool.sol";
import {MockOracle} from "script/mock/MockOracle.sol";
import {LspSwapperFeeHook} from "src/core/helpers/LspSwapperFeeHook.sol";


contract StableSwapTest is BaseProxyTest {
    LSPSwapRouter public lspSwapRouter;
    MockERC20 public stableToken;

    function setUp() public override {
        super.setUp();
        lspSwapRouter = new LSPSwapRouter(address(liquidStabilityPoolProxy), address(liquidStabilityPoolGetters));
        vm.startPrank(owner);
        stableToken = new MockERC20("StableToken", "STABLE", 18, 1_000_000e18);

        // Get NECT price to ensure stable price matches
        uint256 nectPrice = priceFeed.fetchPrice(address(nectarToken));
        console2.log("NECT price (18 decimals):", nectPrice);
        
        // Set stable oracle price to match NECT price
        // NECT is in 18 decimals, stable oracle is in 8 decimals
        // If NECT = 1e18, then stable should be 1e8
        // If NECT = X, then stable should be X / 1e10
        int256 stablePriceIn8Decimals = int256(nectPrice / 1e10); // Convert 18 decimals to 8 decimals
        MockOracle stableOracle = new MockOracle("stable/usd", 8, stablePriceIn8Decimals);
        console2.log("Stable price (8 decimals):", uint256(stablePriceIn8Decimals));
        console2.log("Prices should match: NECT =", nectPrice, ", Stable =", uint256(stablePriceIn8Decimals) * 1e10);

        priceFeed.setOracle(
            address(stableToken), 
            address(stableOracle), 
            86400,
            0,
            address(0)
        );
        
        // Verify prices match
        uint256 stablePrice = priceFeed.fetchPrice(address(stableToken));
        console2.log("Verified stable price (18 decimals):", stablePrice);
        console2.log("Price match:", stablePrice == nectPrice ? "YES" : "NO");
            ILiquidStabilityPool(address(liquidStabilityPoolProxy)).setFeeHook(address(new LspSwapperFeeHook()));
        ILiquidStabilityPool(address(liquidStabilityPoolProxy)).setLspSwapper(address(lspSwapRouter));
        ILiquidStabilityPool(address(liquidStabilityPoolProxy)).setAcceptedStable(address(stableToken), true, uint64(3));
        
        stableToken.approve(address(liquidStabilityPoolProxy), 100e18);
        ILiquidStabilityPool(address(liquidStabilityPoolProxy)).deposit(100e18, owner, address(stableToken));
        deal(address(nectarToken), owner, 120e18);
        ILiquidStabilityPool(address(liquidStabilityPoolProxy)).deposit(120e18, owner, address(nectarToken));



        vm.stopPrank();
    }

    function test_multiStableSwap() public {
  
        vm.startPrank(owner);
        uint initialStableOwnerBalance = stableToken.balanceOf(owner);
        uint initialNectarOwnerBalance = nectarToken.balanceOf(owner);

        stableToken.approve(address(lspSwapRouter), 100e18);    
        lspSwapRouter.swap(address(stableToken), address(nectarToken), 100e18);

        uint afterOwnerStableBalance = stableToken.balanceOf(owner);
        uint afterOwnerNectarBalance = nectarToken.balanceOf(owner);

        assertEq(afterOwnerStableBalance, initialStableOwnerBalance - 100e18);
        assertApproxEqAbs(afterOwnerNectarBalance, initialNectarOwnerBalance + 100e18, 0.31e18);
   }

    function test_depositorCapturesSwapFees() public {
        address depositor = makeAddr("DEPOSITOR");
        ILiquidStabilityPool lsp = ILiquidStabilityPool(address(liquidStabilityPoolProxy));
        
        vm.startPrank(owner);
        deal(address(nectarToken), depositor, 1000e18);
        vm.stopPrank();
        
        vm.startPrank(depositor);
        IERC20(address(nectarToken)).approve(address(liquidStabilityPoolProxy), 1000e18);
        uint256 sharesDeposited = lsp.deposit(1000e18, depositor);
        
        uint256 totalSupplyBefore = lsp.totalSupply();
        uint256 totalAssetsBefore = lsp.totalAssets();
        uint256 shareValueBefore = totalAssetsBefore * 1e18 / totalSupplyBefore;
        uint256 depositorValueBefore = lsp.previewRedeem(sharesDeposited);
        
        // Track balances to see what actually changes
        uint256 nectBalanceBefore = nectarToken.balanceOf(address(liquidStabilityPoolProxy));
        uint256 stableBalanceBefore = stableToken.balanceOf(address(liquidStabilityPoolProxy));
        
        vm.stopPrank();
        
        // Execute swap: stable → NECT
        // This should: deposit stable, withdraw NECT, add fees to pool
        vm.startPrank(owner);
        uint256 swapAmount = 50e18;
        deal(address(stableToken), owner, swapAmount);
        stableToken.approve(address(lspSwapRouter), swapAmount);
        lspSwapRouter.swap(address(stableToken), address(nectarToken), swapAmount);
        vm.stopPrank();
        
        // Check after swap
        vm.startPrank(depositor);
        uint256 totalAssetsAfter = lsp.totalAssets();
        uint256 totalSupplyAfter = lsp.totalSupply();
        uint256 shareValueAfter = totalAssetsAfter * 1e18 / totalSupplyAfter;
        uint256 depositorValueAfter = lsp.previewRedeem(sharesDeposited);
        
        uint256 nectBalanceAfter = nectarToken.balanceOf(address(liquidStabilityPoolProxy));
        uint256 stableBalanceAfter = stableToken.balanceOf(address(liquidStabilityPoolProxy));
        
        // Calculate fees in basis points
        // Total fees = total assets increase (since swap is 1:1, increase is only from fees)
        uint256 totalFeesInBP = ((totalAssetsAfter - totalAssetsBefore) * 10000) / swapAmount;
        uint256 depositorFeesInBP = ((depositorValueAfter - depositorValueBefore) * 10000) / swapAmount;
        
        console2.log("");
        console2.log("Fee Analysis (BP):");
        console2.log("  Total fees in BP:", totalFeesInBP);
        console2.log("  Depositor fees in BP:", depositorFeesInBP);
        console2.log("  Expected: ~5 BP (3 BP deposit + 2 BP redeem)");
        
        // Expected: Swap deposits stable and withdraws NECT
        // Net effect: stable added, NECT removed (approximately 1:1 if prices are equal)
        // Only fees should increase totalAssets and share value
        
        assertGt(depositorValueAfter, depositorValueBefore, "Depositor should capture fees");
        assertGt(depositorValueAfter - depositorValueBefore, 0, "Fees captured should be positive");
        vm.stopPrank();
    }
}   