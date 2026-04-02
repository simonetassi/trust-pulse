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

  struct ReportTally {
      uint256 accurateVotes;
      uint256 inaccurateVotes;
      uint256 availableVotes;
      uint256 unavailableVotes;
      bool accuracyScoreUpdated;
      bool availabilityScoreUpdated;
  }

  uint256 public constant ACCURACY_REWARD = 2;
  uint256 public constant ACCURACY_PENALTY = 5;
  uint256 public constant AVAILABILITY_REWARD = 1;
  uint256 public constant AVAILABILITY_PENALTY = 3;

  address public admin;
  uint256 public oracleCount;
  uint256 public quorum = 2;

  event OperatorRegistered(address indexed operator, string name);
  event DeviceEnrolled(bytes32 indexed deviceId, address indexed operator, string wotEndpoint);
  event AccuracyReported(bytes32 indexed deviceId, bool accurate, uint256 newScore);
  event AvailabilityReported(bytes32 indexed deviceId, bool available, uint256 newScore);
  event DeviceDeactivated(bytes32 indexed deviceId);

  mapping(address => Operator) public operators;

  // deviceId = keccak256(wotEndpoint) -> avoiding incremental ids
  mapping(bytes32 => Device) public devices;
  
  mapping(address => bytes32[]) public operatorDevices;

  mapping(address => bool) public authorizedOracles;
  mapping(bytes32 => mapping(uint256 => ReportTally)) public eventTallies;
  mapping(bytes32 => mapping(uint256 => mapping(address => bool))) public hasVotedAccuracy;
  mapping(bytes32 => mapping(uint256 => mapping(address => bool))) public hasVotedAvailability;

  
  bytes32[] public allDeviceIds;

  constructor() {
      admin = msg.sender;
  }

  modifier onlyAdmin() {
      require(msg.sender == admin, "Caller is not the admin");
      _;
  }

  modifier onlyAuthorizedOracle() {
      require(authorizedOracles[msg.sender], "Caller is not an authorized oracle");
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

  function addOracle(address _oracle) external onlyAdmin {
      require(!authorizedOracles[_oracle], "Oracle already authorized");
      authorizedOracles[_oracle] = true;
      oracleCount++;
  }

  function removeOracle(address _oracle) external onlyAdmin {
      require(authorizedOracles[_oracle], "Oracle not authorized");
      authorizedOracles[_oracle] = false;
      oracleCount--;
      if (quorum > oracleCount && oracleCount > 0) {
          quorum = oracleCount;
      }
  }

  function setQuorum(uint256 _quorum) external onlyAdmin {
      require(_quorum <= oracleCount && _quorum > 0, "Invalid quorum");
      quorum = _quorum;
  }

  function registerOperator(string calldata name) external {
    require(!operators[msg.sender].registered, "Already registered");
    require(bytes(name).length > 0, "Name can not be empty");

    operators[msg.sender] = Operator({
      name: name,
      registered: true,
      registeredAt: block.timestamp
    });

    emit OperatorRegistered(msg.sender, name);
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
    allDeviceIds.push(deviceId);

    emit DeviceEnrolled(deviceId, msg.sender, wotEndpoint);
  }

  function submitAccuracyReport(
    bytes32 deviceId,
    bool accurate,
    uint256 eventId
  ) external onlyAuthorizedOracle deviceExists(deviceId) deviceIsActive(deviceId) {
    
    require(!hasVotedAccuracy[deviceId][eventId][msg.sender], "Oracle already voted for this event");
    hasVotedAccuracy[deviceId][eventId][msg.sender] = true;

    ReportTally storage tally = eventTallies[deviceId][eventId];

    if (accurate) {
      tally.accurateVotes++;
    } else {
      tally.inaccurateVotes++;
    }

    if (!tally.accuracyScoreUpdated) {
      if (tally.accurateVotes >= quorum) {
        _applyAccuracy(deviceId, true);
        tally.accuracyScoreUpdated = true;
      } else if (tally.inaccurateVotes >= quorum) {
        _applyAccuracy(deviceId, false);
        tally.accuracyScoreUpdated = true;
      }
    }
  }

  function submitAvailabilityReport(
    bytes32 deviceId,
    bool available,
    uint256 eventId
  ) external onlyAuthorizedOracle deviceExists(deviceId) deviceIsActive(deviceId) {
    
    require(!hasVotedAvailability[deviceId][eventId][msg.sender], "Oracle already voted for this event");
    hasVotedAvailability[deviceId][eventId][msg.sender] = true;

    hasVotedAvailability[deviceId][eventId][msg.sender] = true;

    ReportTally storage tally = eventTallies[deviceId][eventId];

    if (available) {
      tally.availableVotes++;
    } else {
      tally.unavailableVotes++;
    }

    if (!tally.availabilityScoreUpdated) {
      if (tally.availableVotes >= quorum) {
        _applyAvailability(deviceId, true);
        tally.availabilityScoreUpdated = true;
      } else if (tally.unavailableVotes >= quorum) {
        _applyAvailability(deviceId, false);
        tally.availabilityScoreUpdated = true;
      }
    }
  }

  function deactivateDevice(bytes32 deviceId) external onlyRegisteredOperator deviceExists(deviceId) deviceIsActive(deviceId) {
    require(devices[deviceId].operator == msg.sender, "Only the device owner can deactivate it");

    devices[deviceId].active = false;

    emit DeviceDeactivated(deviceId);
  }

  function getReputation(bytes32 deviceId)
    external
    view
    deviceExists(deviceId)
    returns (
      uint256 accuracy,
      uint256 availability,
      uint256 composite
    ) 
  {
    Device memory device = devices[deviceId];
    accuracy = device.accuracyScore;
    availability = device.availabilityScore;
    composite = (accuracy * 60 + availability * 40) / 100;
  }

  function getOperatorDevices(address operator) 
    external 
    view 
    returns(bytes32[] memory) 
  {
    return operatorDevices[operator];
  }

  function getAllDevices() 
    external
    view 
    returns (bytes32[] memory) 
  {
    return allDeviceIds;
  }

  function _applyAccuracy(bytes32 deviceId, bool accurate) internal {
    Device storage device = devices[deviceId];

    if (accurate) {
      device.accuracyScore = _min(device.accuracyScore + ACCURACY_REWARD, 100);
    } else {
      device.accuracyScore = _safeSubtract(device.accuracyScore, ACCURACY_PENALTY);
    }

    device.totalReports++;
    emit AccuracyReported(deviceId, accurate, device.accuracyScore);
  }

  function _applyAvailability(bytes32 deviceId, bool available) internal {
    Device storage device = devices[deviceId];

    if (available) {
      device.availabilityScore = _min(device.availabilityScore + AVAILABILITY_REWARD, 100);
    } else {
      device.availabilityScore = _safeSubtract(device.availabilityScore, AVAILABILITY_PENALTY);
    }

    device.totalReports++;
    emit AvailabilityReported(deviceId, available, device.availabilityScore);
  }

  function _min(uint256 a, uint256 b) internal pure returns (uint256) {
    return a < b ? a : b;
  }

  // not going below 0
  function _safeSubtract(uint256 a, uint256 b) internal pure returns (uint256) {
    return a > b ? a - b : 0;
  }
}