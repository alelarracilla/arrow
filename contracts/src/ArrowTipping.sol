// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/// @title ArrowTipping
/// @notice Tip creators with native USDC on Arc.
///         On Arc Testnet, USDC is the native currency (18 decimals),
///         msg.value as is native currency.
contract ArrowTipping {

    /// @notice Total tips received by each creator (in wei, 18 decimals)
    mapping(address => uint256) public totalTipsReceived;

    /// @notice Total tips sent by each tipper
    mapping(address => uint256) public totalTipsSent;

    /// @notice Number of unique tippers per creator
    mapping(address => uint256) public uniqueTipperCount;

    /// @notice Whether tipper has tipped creator before
    mapping(address => mapping(address => bool)) public hasTipped;

    /// @notice Platform fee in basis points (e.g. 100 = 1%)
    uint256 public feeBps;

    /// @notice Fee recipient
    address public feeRecipient;

    /// @notice Contract owner
    address public owner;

    event Tip(
        address indexed from,
        address indexed to,
        uint256 amount,
        uint256 fee,
        string message,
        uint256 timestamp
    );

    event FeeUpdated(uint256 oldFee, uint256 newFee);
    event FeeRecipientUpdated(address oldRecipient, address newRecipient);

    error NotOwner();
    error ZeroAmount();
    error ZeroAddress();
    error TransferFailed();
    error FeeTooHigh();


    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }


    /// @param _feeBps Platform fee in basis points (max 500 = 5%, not decided yet)
    /// @param _feeRecipient Address to receive platform fees
    constructor(uint256 _feeBps, address _feeRecipient) {
        if (_feeBps > 500) revert FeeTooHigh();
        if (_feeRecipient == address(0)) revert ZeroAddress();

        owner = msg.sender;
        feeBps = _feeBps;
        feeRecipient = _feeRecipient;
    }


    /// @notice Tip a creator with native USDC
    /// @param to The creator's address
    /// @param message Optional message with the tip
    function tip(address to, string calldata message) external payable {
        if (msg.value == 0) revert ZeroAmount();
        if (to == address(0)) revert ZeroAddress();

        uint256 fee = (msg.value * feeBps) / 10_000;
        uint256 creatorAmount = msg.value - fee;

        // Track stats
        totalTipsReceived[to] += msg.value;
        totalTipsSent[msg.sender] += msg.value;

        if (!hasTipped[msg.sender][to]) {
            hasTipped[msg.sender][to] = true;
            uniqueTipperCount[to]++;
        }

        // Transfer to creator
        (bool success,) = to.call{value: creatorAmount}("");
        if (!success) revert TransferFailed();

        // Transfer fee
        if (fee > 0) {
            (bool feeSuccess,) = feeRecipient.call{value: fee}("");
            if (!feeSuccess) revert TransferFailed();
        }

        emit Tip(msg.sender, to, msg.value, fee, message, block.timestamp);
    }

    //  Admin
 
    function setFee(uint256 _feeBps) external onlyOwner {
        if (_feeBps > 500) revert FeeTooHigh();
        emit FeeUpdated(feeBps, _feeBps);
        feeBps = _feeBps;
    }

    function setFeeRecipient(address _feeRecipient) external onlyOwner {
        if (_feeRecipient == address(0)) revert ZeroAddress();
        emit FeeRecipientUpdated(feeRecipient, _feeRecipient);
        feeRecipient = _feeRecipient;
    }

    function transferOwnership(address newOwner) external onlyOwner {
        if (newOwner == address(0)) revert ZeroAddress();
        owner = newOwner;
    }
}
