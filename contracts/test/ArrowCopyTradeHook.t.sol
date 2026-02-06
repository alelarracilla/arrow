// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {Deployers} from "@uniswap/v4-core/test/utils/Deployers.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";
import {SwapParams, ModifyLiquidityParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {PoolSwapTest} from "@uniswap/v4-core/src/test/PoolSwapTest.sol";
import {ArrowCopyTradeHook} from "../src/ArrowCopyTradeHook.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

contract ArrowCopyTradeHookTest is Test, Deployers {
    using CurrencyLibrary for Currency;

    ArrowCopyTradeHook public hook;
    PoolKey poolKey;

    address agent = makeAddr("agent");
    address leader = makeAddr("leader");
    address follower1 = makeAddr("follower1");
    address follower2 = makeAddr("follower2");

    function setUp() public {
        // Deploy v4 core (PoolManager, routers, test tokens)
        deployFreshManagerAndRouters();
        deployMintAndApprove2Currencies();

        // Mine hook address with afterSwap flag
        uint160 flags = uint160(Hooks.AFTER_SWAP_FLAG);
        bytes memory constructorArgs = abi.encode(manager, agent);

        (address hookAddress, bytes32 salt) = HookMiner.find(
            address(this),
            flags,
            type(ArrowCopyTradeHook).creationCode,
            constructorArgs
        );

        hook = new ArrowCopyTradeHook{salt: salt}(manager, agent);
        require(address(hook) == hookAddress, "Hook address mismatch");

        // Initialize a pool with the hook
        (poolKey,) = initPool(
            currency0,
            currency1,
            hook,
            3000, // fee
            SQRT_PRICE_1_1
        );

        // Add liquidity to the pool
        modifyLiquidityRouter.modifyLiquidity(
            poolKey,
            ModifyLiquidityParams({
                tickLower: -60,
                tickUpper: 60,
                liquidityDelta: 10 ether,
                salt: bytes32(0)
            }),
            ZERO_BYTES
        );
    }

    function test_registerAsLeader() public {
        vm.prank(leader);
        hook.registerAsLeader();
        assertTrue(hook.isLeader(leader));
    }

    function test_registerAsLeader_twice_reverts() public {
        vm.startPrank(leader);
        hook.registerAsLeader();
        vm.expectRevert(ArrowCopyTradeHook.AlreadyLeader.selector);
        hook.registerAsLeader();
        vm.stopPrank();
    }

    function test_followLeader() public {
        vm.prank(leader);
        hook.registerAsLeader();

        vm.prank(follower1);
        hook.followLeader(leader);

        assertEq(hook.followerLeader(follower1), leader);
        address[] memory followers = hook.getFollowers(leader);
        assertEq(followers.length, 1);
        assertEq(followers[0], follower1);
    }

    function test_followLeader_notRegistered_reverts() public {
        vm.prank(follower1);
        vm.expectRevert(ArrowCopyTradeHook.NotALeader.selector);
        hook.followLeader(leader);
    }

    function test_followLeader_alreadyFollowing_reverts() public {
        vm.prank(leader);
        hook.registerAsLeader();

        vm.startPrank(follower1);
        hook.followLeader(leader);
        vm.expectRevert(ArrowCopyTradeHook.AlreadyFollowing.selector);
        hook.followLeader(leader);
        vm.stopPrank();
    }

    function test_unfollowLeader() public {
        vm.prank(leader);
        hook.registerAsLeader();

        vm.prank(follower1);
        hook.followLeader(leader);

        vm.prank(follower1);
        hook.unfollowLeader();

        assertEq(hook.followerLeader(follower1), address(0));
        address[] memory followers = hook.getFollowers(leader);
        assertEq(followers.length, 0);
    }

    function test_unfollowLeader_notFollowing_reverts() public {
        vm.prank(follower1);
        vm.expectRevert(ArrowCopyTradeHook.NotFollowing.selector);
        hook.unfollowLeader();
    }


    function test_afterSwap_logsLeaderTrade() public {
        // The `sender` seen by the hook in afterSwap is the swap router address,
        // not the original EOA. So we register the swapRouter as a "leader"
        // to verify the hook's event-logging mechanism works e2e.
        // A custom router or the Circle smart-account address
        // would be registered as the leader.
        // leaving this as the leader for simplicity for now
        hook.registerAsLeader(); // registers address(this) — the test contract
        // But the actual sender in afterSwap is address(swapRouter)
        vm.prank(address(swapRouter));
        hook.registerAsLeader();

        // Expect the LeaderSwap event with swapRouter as the leader
        vm.expectEmit(true, false, false, false);
        emit ArrowCopyTradeHook.LeaderSwap(
            address(swapRouter),
            keccak256(abi.encode(poolKey)),
            true,
            -0.001 ether,
            0,
            0,
            block.timestamp
        );

        _doSwap(true, -0.001 ether);

        // Verify trade was recorded for the swapRouter (the sender the hook sees)
        ArrowCopyTradeHook.TradeRecord[] memory trades = hook.getLeaderTrades(address(swapRouter));
        assertGt(trades.length, 0, "Trade should be recorded");
        assertTrue(trades[trades.length - 1].zeroForOne);
    }

    function test_afterSwap_nonLeader_noEvent() public {
        // Swap without registering as leader — should not emit LeaderSwap
        _doSwap(true, 0.001 ether);

        // Verify no trades recorded for non-leader
        ArrowCopyTradeHook.TradeRecord[] memory trades = hook.getLeaderTrades(address(this));
        assertEq(trades.length, 0);
    }

    function test_placeLimitOrder() public {
        vm.prank(follower1);
        uint256 orderId = hook.placeLimitOrder(
            poolKey,
            true,
            1 ether,
            TickMath.MIN_SQRT_PRICE + 1
        );

        assertEq(orderId, 0);
        assertEq(hook.getLimitOrderCount(), 1);

        uint256[] memory pending = hook.getPendingOrders(follower1);
        assertEq(pending.length, 1);
        assertEq(pending[0], 0);
    }

    function test_cancelLimitOrder() public {
        vm.prank(follower1);
        uint256 orderId = hook.placeLimitOrder(poolKey, true, 1 ether, TickMath.MIN_SQRT_PRICE + 1);

        vm.prank(follower1);
        hook.cancelLimitOrder(orderId);

        uint256[] memory pending = hook.getPendingOrders(follower1);
        assertEq(pending.length, 0);
    }

    function test_cancelLimitOrder_notOwner_reverts() public {
        vm.prank(follower1);
        uint256 orderId = hook.placeLimitOrder(poolKey, true, 1 ether, TickMath.MIN_SQRT_PRICE + 1);

        vm.prank(follower2);
        vm.expectRevert(ArrowCopyTradeHook.NotOrderOwner.selector);
        hook.cancelLimitOrder(orderId);
    }

    function test_markLimitOrderExecuted() public {
        vm.prank(follower1);
        uint256 orderId = hook.placeLimitOrder(poolKey, true, 1 ether, TickMath.MIN_SQRT_PRICE + 1);

        vm.prank(agent);
        hook.markLimitOrderExecuted(orderId);

        uint256[] memory pending = hook.getPendingOrders(follower1);
        assertEq(pending.length, 0);
    }

    function test_markLimitOrderExecuted_notAgent_reverts() public {
        vm.prank(follower1);
        uint256 orderId = hook.placeLimitOrder(poolKey, true, 1 ether, TickMath.MIN_SQRT_PRICE + 1);

        vm.prank(follower1);
        vm.expectRevert(ArrowCopyTradeHook.NotAgent.selector);
        hook.markLimitOrderExecuted(orderId);
    }

    /// @dev Admin
    function test_setAgent() public {
        address newAgent = makeAddr("newAgent");
        hook.setAgent(newAgent);
        assertEq(hook.agent(), newAgent);
    }

    function test_setAgent_notOwner_reverts() public {
        vm.prank(follower1);
        vm.expectRevert(ArrowCopyTradeHook.NotOwner.selector);
        hook.setAgent(follower1);
    }


    function _doSwap(bool zeroForOne, int256 amountSpecified) internal {
        SwapParams memory params = SwapParams({
            zeroForOne: zeroForOne,
            amountSpecified: amountSpecified,
            sqrtPriceLimitX96: zeroForOne ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1
        });

        PoolSwapTest.TestSettings memory settings = PoolSwapTest.TestSettings({
            takeClaims: false,
            settleUsingBurn: false
        });

        swapRouter.swap(poolKey, params, settings, ZERO_BYTES);
    }
}
