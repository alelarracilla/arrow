// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {ArrowCopyTradeHook} from "../src/ArrowCopyTradeHook.sol";
import {ArrowTipping} from "../src/ArrowTipping.sol";
import {Hooks} from "@uniswap/v4-core/src/libraries/Hooks.sol";
import {HookMiner} from "@uniswap/v4-periphery/src/utils/HookMiner.sol";

contract DeployArrow is Script {
    function run() external {
        address poolManager = vm.envAddress("POOL_MANAGER");
        address agent = vm.envAddress("AGENT_ADDRESS");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        uint256 feeBps = vm.envOr("FEE_BPS", uint256(100)); // 1% default for now, max 500 (tbd)

        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        ArrowTipping tipping = new ArrowTipping(feeBps, feeRecipient);
        console.log("ArrowTipping deployed at:", address(tipping));

        uint160 flags = uint160(Hooks.AFTER_SWAP_FLAG);

        address deployer = vm.addr(deployerPrivateKey);
        bytes memory constructorArgs = abi.encode(IPoolManager(poolManager), agent);

        (address hookAddress, bytes32 salt) = HookMiner.find(
            deployer,
            flags,
            type(ArrowCopyTradeHook).creationCode,
            constructorArgs
        );

        ArrowCopyTradeHook hook = new ArrowCopyTradeHook{salt: salt}(
            IPoolManager(poolManager),
            agent
        );
        require(address(hook) == hookAddress, "Hook address mismatch");
        console.log("ArrowCopyTradeHook deployed at:", address(hook));

        vm.stopBroadcast();
    }
}
