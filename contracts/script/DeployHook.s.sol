// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {ArrowCopyTradeHook} from "../src/ArrowCopyTradeHook.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";

/// @notice Deploy ArrowCopyTradeHook on Base Sepolia (where Uniswap v4 PoolManager lives).
///         Uses CREATE2 salt mining to produce an address with exactly AFTER_SWAP_FLAG set.
///
///         Deploy:
///           forge script script/DeployHook.s.sol --rpc-url base_sepolia --broadcast --evm-version cancun
contract DeployHook is Script {
    function run() external {
        address poolManagerAddr = vm.envAddress("POOL_MANAGER");
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);
        address agent = vm.envOr("AGENT_ADDRESS", deployer);

        console.log("Deployer:", deployer);
        console.log("PoolManager:", poolManagerAddr);
        console.log("Agent:", agent);

        // Pre-mined salt: produces address 0x446e60d8EF420c68D1207557Be0BF72fEb7c8040
        // Last 14 bits = 0x0040 = exactly AFTER_SWAP_FLAG (1 << 6), no other hook flags.
        // Mined off-chain for speed. Re-mine if constructor args change.
        address create2Deployer = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
        bytes32 salt = bytes32(uint256(0x4ee1));

        // Verify the salt still produces a valid hook address
        bytes memory creationCode = type(ArrowCopyTradeHook).creationCode;
        bytes memory constructorArgs = abi.encode(IPoolManager(poolManagerAddr), agent);
        bytes32 initCodeHash = keccak256(abi.encodePacked(creationCode, constructorArgs));
        address predicted = vm.computeCreate2Address(salt, initCodeHash, create2Deployer);

        uint160 ALL_HOOK_FLAGS = uint160(0x3FFF);
        uint160 REQUIRED_FLAGS = uint160(Hooks.AFTER_SWAP_FLAG);
        require(
            (uint160(predicted) & ALL_HOOK_FLAGS) == REQUIRED_FLAGS,
            "Salt invalid - constructor args changed? Re-mine salt."
        );
        console.log("Predicted hook address:", predicted);

        vm.startBroadcast(deployerPrivateKey);

        ArrowCopyTradeHook hook = new ArrowCopyTradeHook{salt: salt}(
            IPoolManager(poolManagerAddr),
            agent
        );
        console.log("ArrowCopyTradeHook deployed at:", address(hook));
        console.log("Agent address:", agent);
        console.log("Owner:", deployer);

        vm.stopBroadcast();
    }
}
