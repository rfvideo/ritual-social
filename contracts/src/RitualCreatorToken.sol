// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title RitualCreatorToken
/// @notice ERC-20 with a simple linear bonding curve for creator social tokens.
///         Buy price increases with supply, sell price decreases. A protocol fee
///         is routed to the RitualTreasury on every trade. Deployed per-creator
///         by RitualCreatorTokenFactory.
contract RitualCreatorToken is ERC20, ReentrancyGuard, Ownable {
    error SlippageExceeded(uint256 expected, uint256 actual);
    error ZeroAmount();
    error TransferFailed();

    uint256 public constant PROTOCOL_FEE_BPS = 500; // 5%
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint256 public constant SLOPE = 1e12; // price per token = supply * SLOPE (wei)

    address public immutable creator;
    address public immutable treasury;

    uint256 public totalCreatorEarnings;

    event Bought(address indexed buyer, uint256 amount, uint256 price, uint256 fee);
    event Sold(address indexed seller, uint256 amount, uint256 refund, uint256 fee);
    event CreatorWithdrawn(uint256 amount);

    constructor(
        string memory name,
        string memory symbol,
        address creatorAddress,
        address treasuryAddress,
        address initialOwner
    ) ERC20(name, symbol) Ownable(initialOwner) {
        creator = creatorAddress;
        treasury = treasuryAddress;
    }

    /// @notice Price in wei to buy `amount` tokens given current supply.
    function buyPrice(uint256 amount) public view returns (uint256) {
        uint256 supply = totalSupply();
        // integral of SLOPE * x from supply to supply+amount
        return (SLOPE * amount * (2 * supply + amount)) / 2;
    }

    /// @notice Refund in wei when selling `amount` tokens.
    function sellRefund(uint256 amount) public view returns (uint256) {
        uint256 supply = totalSupply();
        require(amount <= supply, "RitualCreatorToken: amount exceeds supply");
        return (SLOPE * amount * (2 * supply - amount)) / 2;
    }

    /// @notice Buy creator tokens. Excess ETH is refunded.
    function buy(uint256 minAmountOut) external payable nonReentrant returns (uint256 amount) {
        if (msg.value == 0) revert ZeroAmount();
        amount = _tokensForValue(msg.value, false);
        if (amount < minAmountOut) revert SlippageExceeded(minAmountOut, amount);

        uint256 price = buyPrice(amount);
        uint256 fee = (price * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        totalCreatorEarnings += price - fee;

        _mint(msg.sender, amount);
        _sendETH(treasury, fee);

        uint256 excess = msg.value - price;
        if (excess > 0) _sendETH(msg.sender, excess);

        emit Bought(msg.sender, amount, price, fee);
    }

    /// @notice Sell creator tokens for ETH.
    function sell(uint256 amount, uint256 minRefund) external nonReentrant {
        if (amount == 0) revert ZeroAmount();
        uint256 refund = sellRefund(amount);
        uint256 fee = (refund * PROTOCOL_FEE_BPS) / BPS_DENOMINATOR;
        uint256 netRefund = refund - fee;
        if (netRefund < minRefund) revert SlippageExceeded(minRefund, netRefund);

        _burn(msg.sender, amount);
        totalCreatorEarnings -= netRefund; // approximate accounting; real system tracks separately
        _sendETH(treasury, fee);
        _sendETH(msg.sender, netRefund);

        emit Sold(msg.sender, amount, netRefund, fee);
    }

    function withdrawCreatorEarnings() external nonReentrant {
        require(msg.sender == creator || msg.sender == owner(), "RitualCreatorToken: not creator/owner");
        uint256 amount = totalCreatorEarnings;
        totalCreatorEarnings = 0;
        _sendETH(creator, amount);
        emit CreatorWithdrawn(amount);
    }

    function _tokensForValue(uint256 value, bool /*isBuy*/) internal view returns (uint256) {
        uint256 supply = totalSupply();
        // Solve quadratic: SLOPE * amount^2 + 2*SLOPE*supply*amount - 2*value = 0
        uint256 a = SLOPE;
        uint256 b = 2 * SLOPE * supply;
        uint256 c = 2 * value;
        uint256 discriminant = b * b + 4 * a * c;
        uint256 sqrtDisc = sqrt(discriminant);
        return (sqrtDisc - b) / (2 * a);
    }

    function _sendETH(address to, uint256 amount) internal {
        (bool ok, ) = payable(to).call{value: amount}("");
        if (!ok) revert TransferFailed();
    }

    function sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }

    receive() external payable {
        buy(0);
    }
}
