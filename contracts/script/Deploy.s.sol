// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RitualTreasury} from "../src/RitualTreasury.sol";
import {RitualSocial} from "../src/RitualSocial.sol";

/// @notice Deploys RitualTreasury then RitualSocial, then wires the
///         treasury's socialContract pointer to the freshly deployed
///         RitualSocial address so `deposit()` is callable.
///
///   forge script script/Deploy.s.sol:Deploy \
///     --rpc-url ritual \
///     --private-key $DEPLOYER_PRIVATE_KEY \
///     --broadcast
contract Deploy is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        RitualTreasury treasury = new RitualTreasury(deployer);
        RitualSocial social = new RitualSocial(address(treasury), deployer);
        treasury.setSocialContract(address(social));

        vm.stopBroadcast();

        console2.log("RitualTreasury deployed at:", address(treasury));
        console2.log("RitualSocial   deployed at:", address(social));
        console2.log("Now copy these into your frontend .env as:");
        console2.log("  VITE_RITUAL_TREASURY_ADDRESS=", address(treasury));
        console2.log("  VITE_RITUAL_SOCIAL_ADDRESS=", address(social));
    }
}
