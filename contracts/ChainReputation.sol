// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ChainReputation {

    address public oracle;

    constructor(address _oracle) {
        oracle = _oracle;
    }

    modifier onlyOracle() {
        require(msg.sender == oracle, "Not authorized");
        _;
    }
}