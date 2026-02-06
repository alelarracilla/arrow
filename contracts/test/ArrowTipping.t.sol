// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Test, console} from "forge-std/Test.sol";
import {ArrowTipping} from "../src/ArrowTipping.sol";

contract ArrowTippingTest is Test {
    ArrowTipping public tipping;

    address owner = address(this);
    address feeRecipient = makeAddr("feeRecipient");
    address creator = makeAddr("creator");
    address tipper = makeAddr("tipper");
    address tipper2 = makeAddr("tipper2");

    uint256 constant FEE_BPS = 100; // 1%

    function setUp() public {
        tipping = new ArrowTipping(FEE_BPS, feeRecipient);
        vm.deal(tipper, 100 ether);
        vm.deal(tipper2, 100 ether);
    }

    function test_tip_basic() public {
        uint256 tipAmount = 10 ether;
        uint256 expectedFee = (tipAmount * FEE_BPS) / 10_000; // 0.1 ether
        uint256 expectedCreatorAmount = tipAmount - expectedFee;

        uint256 creatorBalBefore = creator.balance;
        uint256 feeBalBefore = feeRecipient.balance;

        vm.prank(tipper);
        tipping.tip{value: tipAmount}(creator, "Great analysis!");

        assertEq(creator.balance - creatorBalBefore, expectedCreatorAmount);
        assertEq(feeRecipient.balance - feeBalBefore, expectedFee);
        assertEq(tipping.totalTipsReceived(creator), tipAmount);
        assertEq(tipping.totalTipsSent(tipper), tipAmount);
        assertEq(tipping.uniqueTipperCount(creator), 1);
        assertTrue(tipping.hasTipped(tipper, creator));
    }

    function test_tip_emitsEvent() public {
        uint256 tipAmount = 5 ether;
        uint256 expectedFee = (tipAmount * FEE_BPS) / 10_000;

        vm.prank(tipper);
        vm.expectEmit(true, true, false, true);
        emit ArrowTipping.Tip(tipper, creator, tipAmount, expectedFee, "Hello", block.timestamp);
        tipping.tip{value: tipAmount}(creator, "Hello");
    }

    function test_tip_multipleTippers() public {
        vm.prank(tipper);
        tipping.tip{value: 1 ether}(creator, "tip1");

        vm.prank(tipper2);
        tipping.tip{value: 2 ether}(creator, "tip2");

        assertEq(tipping.totalTipsReceived(creator), 3 ether);
        assertEq(tipping.uniqueTipperCount(creator), 2);
    }

    function test_tip_sameTipperTwice_uniqueCountStaysOne() public {
        vm.startPrank(tipper);
        tipping.tip{value: 1 ether}(creator, "first");
        tipping.tip{value: 2 ether}(creator, "second");
        vm.stopPrank();

        assertEq(tipping.totalTipsReceived(creator), 3 ether);
        assertEq(tipping.totalTipsSent(tipper), 3 ether);
        assertEq(tipping.uniqueTipperCount(creator), 1);
    }

    function test_tip_zeroAmount_reverts() public {
        vm.prank(tipper);
        vm.expectRevert(ArrowTipping.ZeroAmount.selector);
        tipping.tip{value: 0}(creator, "");
    }

    function test_tip_zeroAddress_reverts() public {
        vm.prank(tipper);
        vm.expectRevert(ArrowTipping.ZeroAddress.selector);
        tipping.tip{value: 1 ether}(address(0), "");
    }

    function test_setFee() public {
        tipping.setFee(200);
        assertEq(tipping.feeBps(), 200);
    }

    function test_setFee_tooHigh_reverts() public {
        vm.expectRevert(ArrowTipping.FeeTooHigh.selector);
        tipping.setFee(501);
    }

    function test_setFee_notOwner_reverts() public {
        vm.prank(tipper);
        vm.expectRevert(ArrowTipping.NotOwner.selector);
        tipping.setFee(200);
    }

    function test_setFeeRecipient() public {
        address newRecipient = makeAddr("newRecipient");
        tipping.setFeeRecipient(newRecipient);
        assertEq(tipping.feeRecipient(), newRecipient);
    }

    function test_constructor_feeTooHigh_reverts() public {
        vm.expectRevert(ArrowTipping.FeeTooHigh.selector);
        new ArrowTipping(501, feeRecipient);
    }

    function test_constructor_zeroFeeRecipient_reverts() public {
        vm.expectRevert(ArrowTipping.ZeroAddress.selector);
        new ArrowTipping(100, address(0));
    }

    function test_zeroFee_noFeeTransfer() public {
        ArrowTipping noFeeTipping = new ArrowTipping(0, feeRecipient);
        uint256 feeBalBefore = feeRecipient.balance;

        vm.prank(tipper);
        noFeeTipping.tip{value: 1 ether}(creator, "no fee");

        assertEq(feeRecipient.balance, feeBalBefore); // no fee sent
        assertEq(creator.balance, 1 ether);
    }
}
