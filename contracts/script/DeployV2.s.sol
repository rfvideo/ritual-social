// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RitualTreasury} from "../src/RitualTreasury.sol";
import {RitualSocialV2} from "../src/RitualSocialV2.sol";

contract DeployV2 is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        vm.startBroadcast(deployerKey);

        RitualTreasury treasury = new RitualTreasury(deployer);
        RitualSocialV2 social = new RitualSocialV2(address(treasury), deployer);
        treasury.setSocialContract(address(social));

        vm.stopBroadcast();

        console2.log("RitualTreasury   deployed at:", address(treasury));
        console2.log("RitualSocialV2   deployed at:", address(social));
    }
}
