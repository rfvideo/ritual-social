// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {RitualCreatorToken} from "./RitualCreatorToken.sol";

/// @title RitualCreatorTokenFactory
/// @notice Deploys a bonding-curve social token for each creator. Tracks
///         deployed tokens so the frontend can enumerate them by creator.
contract RitualCreatorTokenFactory is Ownable {
    error ZeroAddress();
    error TokenAlreadyExists();

    address public immutable treasury;

    /// @notice creator => deployed token
    mapping(address => address) public tokenForCreator;
    address[] public allTokens;

    event CreatorTokenCreated(
        address indexed creator,
        address indexed token,
        string name,
        string symbol
    );

    constructor(address treasuryAddress, address initialOwner) Ownable(initialOwner) {
        if (treasuryAddress == address(0)) revert ZeroAddress();
        treasury = treasuryAddress;
    }

    /// @notice Deploy a creator token. Only one token per creator.
    function createToken(string calldata name, string calldata symbol) external returns (address token) {
        if (tokenForCreator[msg.sender] != address(0)) revert TokenAlreadyExists();

        token = address(new RitualCreatorToken(name, symbol, msg.sender, treasury, owner()));
        tokenForCreator[msg.sender] = token;
        allTokens.push(token);

        emit CreatorTokenCreated(msg.sender, token, name, symbol);
    }

    function getToken(address creator) external view returns (address) {
        return tokenForCreator[creator];
    }

    function getAllTokens() external view returns (address[] memory) {
        return allTokens;
    }
}
