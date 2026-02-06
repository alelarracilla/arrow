// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {PoolManager} from "@uniswap/v4-core/src/PoolManager.sol";
import {ArrowTipping} from "../src/ArrowTipping.sol";

/// @notice Phase 1: Deploy PoolManager + ArrowTipping to Arc testnet.
///         Run DeployHook.s.sol after this to deploy the copy-trade hook.
contract DeployArrow is Script {
    function run() external {
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        uint256 feeBps = vm.envOr("FEE_BPS", uint256(100));
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy PoolManager (Uniswap v4 not on Arc testnet yet)
        address poolManagerAddr = vm.envOr("POOL_MANAGER", address(0));
        if (poolManagerAddr == address(0)) {
            PoolManager pm = new PoolManager(deployer);
            poolManagerAddr = address(pm);
            console.log("PoolManager deployed at:", poolManagerAddr);
        } else {
            console.log("Using existing PoolManager:", poolManagerAddr);
        }

        // 2. Deploy ArrowTipping
        ArrowTipping tipping = new ArrowTipping(feeBps, feeRecipient);
        console.log("ArrowTipping deployed at:", address(tipping));

        console.log("\n=== Next step ===");
        console.log("Set POOL_MANAGER in .env to the address above, then run:");
        console.log("forge script script/DeployHook.s.sol --rpc-url arc_testnet --broadcast");

        vm.stopBroadcast();
    }
}
