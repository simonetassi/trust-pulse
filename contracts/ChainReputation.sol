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

  uint256 public constant ACCURACY_REWARD = 2;
  uint256 public constant ACCURACY_PENALTY = 5;
  uint256 public constant AVAILABILITY_REWARD = 1;
  uint256 public constant AVAILABILITY_PENALTY = 3;

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

  function enrollDevice(
    string calldata wotEndpoint,
    string calldata deviceType
  ) external onlyRegisteredOperator {
    bytes32 deviceId = keccak256(abi.encodePacked(wotEndpoint));

    require(devices[deviceId].registeredAt == 0, "Device already enrolled");
    require(bytes(wotEndpoint).length > 0, "Endpoint can not be empty");

    devices[deviceId] = Device({
      operator: msg.sender,
      wotEndpoint: wotEndpoint,
      deviceType: deviceType,
      accuracyScore: 50,
      availabilityScore: 50,
      totalReports: 0,
      registeredAt: block.timestamp,
      active: true
    });

    operatorDevices[msg.sender].push(deviceId);
  }

  function submitAccuracyReport(
    bytes32 deviceId,
    bool accurate
  ) external onlyOracle deviceExists(deviceId) deviceIsActive(deviceId) {
    Device storage device = devices[deviceId];

    if (accurate) {
      device.accuracyScore = _min(device.accuracyScore + ACCURACY_REWARD, 100);
    } else {
      device.accuracyScore = _safeSubtract(device.accuracyScore, ACCURACY_PENALTY);
    }

    device.totalReports++;
  }

  function submitAvailabilityReport(
    bytes32 deviceId,
    bool accurate
  ) external onlyOracle deviceExists(deviceId) deviceIsActive(deviceId) {
    Device storage device = devices[deviceId];

    if (accurate) {
      device.accuracyScore = _min(device.availabilityScore + AVAILABILITY_REWARD, 100);
    } else {
      device.accuracyScore = _safeSubtract(device.availabilityScore, AVAILABILITY_PENALTY);
    }

    device.totalReports++;
  }

  function deactivateDevice(bytes32 deviceId) external onlyRegisteredOperator deviceExists(deviceId) deviceIsActive(deviceId) {
    require(devices[deviceId].operator == msg.sender, "Only the device owner can deactivate it");

    devices[deviceId].active = false;
  }

  function _min(uint256 a, uint256 b) internal pure returns (uint256) {
    return a < b ? a : b;
  }

  function _safeSubtract(uint256 a, uint256 b) internal pure returns (uint256) {
    return a > b ? a - b : 0;
  }


}