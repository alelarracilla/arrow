// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {BaseHook} from "@uniswap/v4-periphery/src/utils/BaseHook.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BalanceDelta} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {SwapParams} from "@uniswap/v4-core/src/types/PoolOperation.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";

/// @title ArrowCopyTradeHook
/// @notice Uniswap v4 hook that enables copy-trading on Arc.
///         Leaders trade normally. The afterSwap hook logs their trades.
///         An off-chain agent monitors LeaderSwap events and replays them
///         for each follower's Circle smart-account wallet via bundlerClient.
///         Followers can also place limit orders that the agent executes
///         when price conditions are met.
contract ArrowCopyTradeHook is BaseHook {
    struct TradeRecord {
        PoolKey key;
        bool zeroForOne;
        int256 amountSpecified;
        uint160 sqrtPriceLimitX96;
        uint256 timestamp;
    }

    struct LimitOrder {
        address owner;
        PoolKey key;
        bool zeroForOne;
        int256 amountSpecified;
        uint160 triggerPrice;
        bool executed;
        uint256 createdAt;
    }

    mapping(address => address[]) public leaderFollowers;
    mapping(address => address) public followerLeader;
    mapping(address => bool) public isLeader;
    mapping(address => TradeRecord[]) public leaderTrades;

    LimitOrder[] public limitOrders;

    address public agent;
    address public owner;
    uint256 public constant MAX_TRADE_HISTORY = 50;

    event LeaderRegistered(address indexed leader);
    event FollowerAdded(address indexed follower, address indexed leader);
    event FollowerRemoved(address indexed follower, address indexed leader);
    event LeaderSwap(
        address indexed leader,
        bytes32 indexed poolId,
        bool zeroForOne,
        int256 amountSpecified,
        int128 delta0,
        int128 delta1,
        uint256 timestamp
    );
    event LimitOrderCreated(
        uint256 indexed orderId,
        address indexed owner,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 triggerPrice
    );
    event LimitOrderExecuted(uint256 indexed orderId, address indexed owner);
    event LimitOrderCancelled(uint256 indexed orderId, address indexed owner);
    event AgentUpdated(address indexed oldAgent, address indexed newAgent);

    error NotOwner();
    error NotAgent();
    error AlreadyLeader();
    error NotALeader();
    error AlreadyFollowing();
    error NotFollowing();
    error OrderAlreadyExecuted();
    error NotOrderOwner();
    error InvalidOrderId();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyAgent() {
        if (msg.sender != agent) revert NotAgent();
        _;
    }

    constructor(IPoolManager _manager, address _agent) BaseHook(_manager) {
        owner = msg.sender;
        agent = _agent;
    }

    function getHookPermissions() public pure override returns (Hooks.Permissions memory) {
        return Hooks.Permissions({
            beforeInitialize: false,
            afterInitialize: false,
            beforeAddLiquidity: false,
            afterAddLiquidity: false,
            beforeRemoveLiquidity: false,
            afterRemoveLiquidity: false,
            beforeSwap: false,
            afterSwap: true, // <-- we only need afterSwap to log leader trades
            beforeDonate: false,
            afterDonate: false,
            beforeSwapReturnDelta: false,
            afterSwapReturnDelta: false,
            afterAddLiquidityReturnDelta: false,
            afterRemoveLiquidityReturnDelta: false
        });
    }
    
    //  afterSwap — core

    /// @notice Called after every swap on pools using this hook.
    ///         If the sender is a registered leader, log the trade
    ///         so the off-chain agent can replay it for followers.
    function _afterSwap(
        address sender,
        PoolKey calldata key,
        SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) internal override returns (bytes4, int128) {
        if (isLeader[sender]) {
            // Store trade record
            TradeRecord memory trade = TradeRecord({
                key: key,
                zeroForOne: params.zeroForOne,
                amountSpecified: params.amountSpecified,
                sqrtPriceLimitX96: params.sqrtPriceLimitX96,
                timestamp: block.timestamp
            });

            TradeRecord[] storage trades = leaderTrades[sender];
            if (trades.length >= MAX_TRADE_HISTORY) {
                for (uint256 i = 0; i < trades.length - 1; i++) {
                    trades[i] = trades[i + 1];
                }
                trades.pop();
            }
            trades.push(trade);

            // Emit event for the off-chain agent -> speak with web2 services
            emit LeaderSwap(
                sender,
                keccak256(abi.encode(key)),
                params.zeroForOne,
                params.amountSpecified,
                delta.amount0(),
                delta.amount1(),
                block.timestamp
            );
        }

        return (this.afterSwap.selector, 0);
    }

    //  Leader / Follower Management

    /// @notice Register as a copy-trade leader
    function registerAsLeader() external {
        if (isLeader[msg.sender]) revert AlreadyLeader();
        isLeader[msg.sender] = true;
        emit LeaderRegistered(msg.sender);
    }

    /// @notice Follow a leader to copy their trades
    function followLeader(address leader) external {
        if (!isLeader[leader]) revert NotALeader();
        if (followerLeader[msg.sender] != address(0)) revert AlreadyFollowing();

        followerLeader[msg.sender] = leader;
        leaderFollowers[leader].push(msg.sender);

        emit FollowerAdded(msg.sender, leader);
    }

    /// @notice Unfollow current leader
    function unfollowLeader() external {
        address leader = followerLeader[msg.sender];
        if (leader == address(0)) revert NotFollowing();

        // Remove from leader's follower list
        address[] storage followers = leaderFollowers[leader];
        for (uint256 i = 0; i < followers.length; i++) {
            if (followers[i] == msg.sender) {
                followers[i] = followers[followers.length - 1];
                followers.pop();
                break;
            }
        }

        delete followerLeader[msg.sender];
        emit FollowerRemoved(msg.sender, leader);
    }

    /// @notice Place a limit order that the agent will execute when price is reached
    function placeLimitOrder(
        PoolKey calldata key,
        bool zeroForOne,
        int256 amountSpecified,
        uint160 triggerPrice
    ) external returns (uint256 orderId) {
        orderId = limitOrders.length;
        limitOrders.push(LimitOrder({
            owner: msg.sender,
            key: key,
            zeroForOne: zeroForOne,
            amountSpecified: amountSpecified,
            triggerPrice: triggerPrice,
            executed: false,
            createdAt: block.timestamp
        }));

        emit LimitOrderCreated(orderId, msg.sender, zeroForOne, amountSpecified, triggerPrice);
    }

    /// @notice Cancel a pending limit order
    function cancelLimitOrder(uint256 orderId) external {
        if (orderId >= limitOrders.length) revert InvalidOrderId();
        LimitOrder storage order = limitOrders[orderId];
        if (order.owner != msg.sender) revert NotOrderOwner();
        if (order.executed) revert OrderAlreadyExecuted();

        order.executed = true; // mark as executed to prevent future execution
        emit LimitOrderCancelled(orderId, msg.sender);
    }

    /// @notice Agent marks a limit order as executed (after submitting the swap tx)
    function markLimitOrderExecuted(uint256 orderId) external onlyAgent {
        if (orderId >= limitOrders.length) revert InvalidOrderId();
        LimitOrder storage order = limitOrders[orderId];
        if (order.executed) revert OrderAlreadyExecuted();

        order.executed = true;
        emit LimitOrderExecuted(orderId, order.owner);
    }

    /// @notice Get all followers of a leader
    function getFollowers(address leader) external view returns (address[] memory) {
        return leaderFollowers[leader];
    }

    /// @notice Get trade history for a leader
    function getLeaderTrades(address leader) external view returns (TradeRecord[] memory) {
        return leaderTrades[leader];
    }

    /// @notice Get number of pending limit orders
    function getLimitOrderCount() external view returns (uint256) {
        return limitOrders.length;
    }

    /// @notice Get pending (unexecuted) limit orders for a user
    function getPendingOrders(address user) external view returns (uint256[] memory) {
        uint256 count = 0;
        for (uint256 i = 0; i < limitOrders.length; i++) {
            if (limitOrders[i].owner == user && !limitOrders[i].executed) {
                count++;
            }
        }

        uint256[] memory ids = new uint256[](count);
        uint256 idx = 0;
        for (uint256 i = 0; i < limitOrders.length; i++) {
            if (limitOrders[i].owner == user && !limitOrders[i].executed) {
                ids[idx++] = i;
            }
        }
        return ids;
    }

    //  Admin
    function setAgent(address _agent) external onlyOwner {
        emit AgentUpdated(agent, _agent);
        agent = _agent;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        owner = newOwner;
    }
}
