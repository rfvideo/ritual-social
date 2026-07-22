// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title RitualReputation
/// @notice On-chain reputation ledger for Ritual Social. Scores are computed
///         off-chain by Ritual's TEE-verified LLM and committed on-chain
///         together with an attestation hash that anyone can verify against
///         the settled Ritual LLM receipt. The score powers feed ranking,
///         access gating, and creator discovery in the app.
contract RitualReputation is Ownable {
    error ZeroAddress();
    error ScoreOutOfRange(uint8 score);

    struct Reputation {
        uint8 score;          // 0-100
        uint64 lastUpdatedAt; // block timestamp
        bytes32 proofHash;    // attestation / tx hash of the LLM call that produced this score
        bool exists;
    }

    /// @notice reputation score per account (0-100)
    mapping(address => Reputation) public reputations;

    /// @notice authorized updater (ideally a TEE oracle / relayer that reads
    ///         Ritual LLM settlement receipts). Owner can rotate it.
    address public updater;

    event ReputationUpdated(
        address indexed account,
        uint8 score,
        bytes32 proofHash,
        uint64 timestamp
    );

    event UpdaterChanged(address indexed oldUpdater, address indexed newUpdater);

    constructor(address initialOwner, address initialUpdater) Ownable(initialOwner) {
        if (initialUpdater == address(0)) revert ZeroAddress();
        updater = initialUpdater;
    }

    modifier onlyUpdater() {
        require(msg.sender == updater || msg.sender == owner(), "RitualReputation: not authorized");
        _;
    }

    /// @notice Commit a reputation score computed by Ritual's TEE-verified LLM.
    ///         The proofHash lets anyone look up the corresponding LLM receipt.
    function updateReputation(address account, uint8 score, bytes32 proofHash) external onlyUpdater {
        if (account == address(0)) revert ZeroAddress();
        if (score > 100) revert ScoreOutOfRange(score);

        reputations[account] = Reputation({
            score: score,
            lastUpdatedAt: uint64(block.timestamp),
            proofHash: proofHash,
            exists: true
        });

        emit ReputationUpdated(account, score, proofHash, uint64(block.timestamp));
    }

    function getReputation(address account) external view returns (Reputation memory) {
        return reputations[account];
    }

    function setUpdater(address newUpdater) external onlyOwner {
        if (newUpdater == address(0)) revert ZeroAddress();
        emit UpdaterChanged(updater, newUpdater);
        updater = newUpdater;
    }
}
