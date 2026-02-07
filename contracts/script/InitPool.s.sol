// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

interface IWETH {
    function deposit() external payable;
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

interface IERC20 {
    function approve(address, uint256) external returns (bool);
    function balanceOf(address) external view returns (uint256);
}

interface IPoolModifyLiquidityTest {
    struct ModifyLiquidityParams {
        int24 tickLower;
        int24 tickUpper;
        int256 liquidityDelta;
        bytes32 salt;
    }
    function modifyLiquidity(
        PoolKey calldata key,
        ModifyLiquidityParams calldata params,
        bytes calldata hookData
    ) external payable returns (int256, int256);
}

/// @notice Initialize WETH/USDC pool on Base Sepolia with ArrowCopyTradeHook and add liquidity.
///
///   forge script script/InitPool.s.sol --rpc-url base_sepolia --broadcast --evm-version cancun
contract InitPool is Script {
    // Base Sepolia addresses
    address constant POOL_MANAGER = 0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408;
    address constant POOL_MODIFY_LIQUIDITY_TEST = 0x37429cD17Cb1454C34E7F50b09725202Fd533039;
    address constant WETH = 0x4200000000000000000000000000000000000006;
    address constant USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    address constant HOOK = 0x446e60d8EF420c68D1207557Be0BF72fEb7c8040;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        console.log("Deployer:", deployer);
        console.log("WETH balance:", IWETH(WETH).balanceOf(deployer));
        console.log("USDC balance:", IERC20(USDC).balanceOf(deployer));
        console.log("ETH balance:", deployer.balance);

        // USDC (0x036C...) < WETH (0x4200...) by address
        require(uint160(USDC) < uint160(WETH), "Token order wrong");

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(USDC),
            currency1: Currency.wrap(WETH),
            fee: 3000,
            tickSpacing: 60,
            hooks: IHooks(HOOK)
        });

        // price in v4 = token1/token0 = WETH/USDC (in raw units)
        // 1 WETH (1e18) = 2000 USDC (2000e6)
        // raw price = 1e18 / 2000e6 = 1e18 / 2e9 = 5e8
        // sqrtPriceX96 = sqrt(5e8) * 2^96
        // sqrt(5e8) = 22360.6797...
        // sqrtPriceX96 = 22360.6797 * 79228162514264337593543950336 ≈ 1.7716e39
        // Using TickMath: tick ≈ 200286 for this price
        uint160 sqrtPriceX96 = 1771595571142957166518320255467520;

        vm.startBroadcast(deployerPrivateKey);

        // Step 1: Initialize the pool
        console.log("Initializing USDC/WETH pool...");
        IPoolManager(POOL_MANAGER).initialize(key, sqrtPriceX96);
        console.log("Pool initialized!");

        // Step 2: Wrap ETH -> WETH for liquidity
        uint256 wethAmount = 0.001 ether;
        console.log("Wrapping ETH -> WETH:", wethAmount);
        IWETH(WETH).deposit{value: wethAmount}();

        // Step 3: Approve tokens for PoolModifyLiquidityTest
        IWETH(WETH).approve(POOL_MODIFY_LIQUIDITY_TEST, type(uint256).max);
        IERC20(USDC).approve(POOL_MODIFY_LIQUIDITY_TEST, type(uint256).max);

        // Step 4: Add liquidity — wide range around current price
        // At 4e14 it needed ~17888 USDC. We have ~22 USDC.
        // Scale: 4e14 * (22/17888) ≈ 4.9e8. Use 4e8 for safety.
        console.log("Adding liquidity...");
        IPoolModifyLiquidityTest(POOL_MODIFY_LIQUIDITY_TEST).modifyLiquidity(
            key,
            IPoolModifyLiquidityTest.ModifyLiquidityParams({
                tickLower: -887220,  // near min tick (divisible by 60)
                tickUpper: 887220,   // near max tick (divisible by 60)
                liquidityDelta: 4e8, // ~18 USDC + tiny WETH
                salt: bytes32(0)
            }),
            ""
        );

        console.log("Liquidity added!");
        console.log("WETH remaining:", IWETH(WETH).balanceOf(deployer));
        console.log("USDC remaining:", IERC20(USDC).balanceOf(deployer));

        vm.stopBroadcast();
    }
}
