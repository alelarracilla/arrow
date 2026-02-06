// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {ArrowCopyTradeHook} from "../src/ArrowCopyTradeHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";

/// @notice Phase 2: Deploy ArrowCopyTradeHook after PoolManager is deployed.
///         Requires POOL_MANAGER to be set in .env.
contract DeployHook is Script {
    function run() external {
        address poolManagerAddr = vm.envAddress("POOL_MANAGER");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address agent = vm.envOr("AGENT_ADDRESS", deployer);

        // Mine salt off-chain (before broadcast) so CREATE2 address has AFTER_SWAP_FLAG
        address create2Deployer = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
        uint160 flags = uint160(Hooks.AFTER_SWAP_FLAG);
        bytes memory creationCode = type(ArrowCopyTradeHook).creationCode;
        bytes memory constructorArgs = abi.encode(IPoolManager(poolManagerAddr), agent);
        bytes32 initCodeHash = keccak256(abi.encodePacked(creationCode, constructorArgs));

        bytes32 salt;
        bool found = false;
        for (uint256 i = 0; i < 500000; i++) {
            salt = bytes32(i);
            address predicted = vm.computeCreate2Address(salt, initCodeHash, create2Deployer);
            if ((uint160(predicted) & flags) == flags) {
                console.log("Found valid salt at iteration:", i);
                console.log("Predicted hook address:", predicted);
                found = true;
                break;
            }
        }

        require(found, "Could not find valid hook salt");

        vm.startBroadcast(deployerPrivateKey);

        ArrowCopyTradeHook hook = new ArrowCopyTradeHook{salt: salt}(
            IPoolManager(poolManagerAddr),
            agent
        );
        console.log("ArrowCopyTradeHook deployed at:", address(hook));
        console.log("Agent address:", agent);

        vm.stopBroadcast();
    }
}
