// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {RitualTreasury} from "../src/RitualTreasury.sol";
import {RitualSocial} from "../src/RitualSocial.sol";
import {RitualReputation} from "../src/RitualReputation.sol";
import {RitualCreatorTokenFactory} from "../src/RitualCreatorTokenFactory.sol";

/// @notice Deploys the full Ritual Social contract suite:
///         - RitualTreasury (fee routing)
///         - RitualSocial (social graph + content ledger)
///         - RitualReputation (on-chain reputation scores, TEE-LLM attested)
///         - RitualCreatorTokenFactory (bonding-curve social tokens)
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

        // Reputation updater starts as the deployer; in production this should
        // be a TEE oracle / relayer that reads Ritual LLM settlement receipts.
        RitualReputation reputation = new RitualReputation(deployer, deployer);
        RitualCreatorTokenFactory tokenFactory = new RitualCreatorTokenFactory(address(treasury), deployer);

        vm.stopBroadcast();

        console2.log("RitualTreasury           deployed at:", address(treasury));
        console2.log("RitualSocial             deployed at:", address(social));
        console2.log("RitualReputation         deployed at:", address(reputation));
        console2.log("RitualCreatorTokenFactory deployed at:", address(tokenFactory));
        console2.log("Now copy these into your frontend .env as:");
        console2.log("  VITE_RITUAL_TREASURY_ADDRESS=", address(treasury));
        console2.log("  VITE_RITUAL_SOCIAL_ADDRESS=", address(social));
        console2.log("  VITE_RITUAL_REPUTATION_ADDRESS=", address(reputation));
        console2.log("  VITE_RITUAL_CREATOR_TOKEN_FACTORY_ADDRESS=", address(tokenFactory));
    }
}
