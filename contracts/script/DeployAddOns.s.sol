// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RitualReputation} from "../src/RitualReputation.sol";
import {RitualCreatorTokenFactory} from "../src/RitualCreatorTokenFactory.sol";

/// @notice Deploys ONLY the new add-on contracts (RitualReputation + RitualCreatorTokenFactory)
///         while keeping the existing RitualSocial and RitualTreasury untouched.
///         Use this when you already have live RitualSocial/Treasury contracts and want
///         to preserve their data (posts, profiles, followers, treasury balance).
///
///   forge script script/DeployAddOns.s.sol:DeployAddOns \
///     --rpc-url ritual \
///     --private-key $DEPLOYER_PRIVATE_KEY \
///     --broadcast
contract DeployAddOns is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address treasury = vm.envAddress("VITE_RITUAL_TREASURY_ADDRESS");

        vm.startBroadcast(deployerKey);

        // Reputation updater starts as the deployer. Replace with a TEE oracle
        // relayer later via setUpdater() if you want fully autonomous attestation.
        RitualReputation reputation = new RitualReputation(deployer, deployer);
        RitualCreatorTokenFactory tokenFactory = new RitualCreatorTokenFactory(treasury, deployer);

        vm.stopBroadcast();

        console2.log("RitualReputation         deployed at:", address(reputation));
        console2.log("RitualCreatorTokenFactory deployed at:", address(tokenFactory));
        console2.log("Add these to your frontend .env (keep the existing social/treasury addresses):");
        console2.log("  VITE_RITUAL_REPUTATION_ADDRESS=", address(reputation));
        console2.log("  VITE_RITUAL_CREATOR_TOKEN_FACTORY_ADDRESS=", address(tokenFactory));
    }
}
