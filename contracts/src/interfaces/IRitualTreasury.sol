// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IRitualTreasury {
    /// @notice Records a fee deposit from a social action. Payable so the
    ///         caller (RitualSocial) can forward msg.value in the same call.
    /// @param payer The end-user wallet whose action generated the fee.
    function deposit(address payer) external payable;
}
