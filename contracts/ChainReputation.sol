// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract ChainReputation {

  struct Operator {
    string name;
    bool registered;
    uint256 registeredAt;
  }

  struct Device {
    address operator;
    string wotEndpoint;
    string deviceType;
    uint256 accuracyScore;
    uint256 availabilityScore;
    uint256 totalReports;
    uint256 registeredAt;
    bool active;
  }


  address public oracle;

  constructor(address _oracle) {
      oracle = _oracle;
  }

  modifier onlyOracle() {
      require(msg.sender == oracle, "Not authorized");
      _;
  }
}