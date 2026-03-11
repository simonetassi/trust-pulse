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

  mapping(address => Operator) public operators;

  // deviceId = keccak256(wotEndpoint) -> avoiding incremental ids
  mapping(bytes32 => Device) public devices;
  
  mapping(address => bytes32[]) public operatorDevices;

  constructor(address _oracle) {
      oracle = _oracle;
  }

  modifier onlyOracle() {
      require(msg.sender == oracle, "Caller is not the oracle");
      _;
  }

  modifier onlyRegisteredOperator() {
    require(operators[msg.sender].registered, "Caller is not a registered operator");
    _;
  }

  modifier deviceExists(bytes32 deviceId) {
    require(devices[deviceId].registeredAt != 0, "Device does not exist");
    _;
  }

  modifier deviceIsActive(bytes32 deviceId) {
    require(devices[deviceId].active, "Device is not active");
    _;
  }

  function registerOperator(string calldata name) external {
    require(!operators[msg.sender].registered, "Already registered");
    require(bytes(name).length > 0, "Name can not be empty");

    operators[msg.sender] = Operator({
      name: name,
      registered: true,
      registeredAt: block.timestamp
    });
  }

}