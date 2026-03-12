import { expect } from "chai";
import { ethers } from "hardhat";
import { ChainReputation } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ChainReputation", function () {

  let contract: ChainReputation;
  let oracle: SignerWithAddress;
  let operator1: SignerWithAddress;
  let operator2: SignerWithAddress;
  let stranger: SignerWithAddress;

  let ACCURACY_REWARD: bigint;
  let ACCURACY_PENALTY: bigint;
  let AVAILABILITY_REWARD: bigint;
  let AVAILABILITY_PENALTY: bigint;

  const DEVICE_ENDPOINT = "http://192.168.1.10:8080/wot/sensor-01";
  const DEVICE_TYPE = "temperature-sensor";
  const deviceId = ethers.keccak256(ethers.toUtf8Bytes(DEVICE_ENDPOINT));

  beforeEach(async function () {
    [oracle, operator1, operator2, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ChainReputation");
    contract = await Factory.deploy(oracle.address) as ChainReputation;

    ACCURACY_REWARD      = await contract.ACCURACY_REWARD();
    ACCURACY_PENALTY     = await contract.ACCURACY_PENALTY();
    AVAILABILITY_REWARD  = await contract.AVAILABILITY_REWARD();
    AVAILABILITY_PENALTY = await contract.AVAILABILITY_PENALTY();
  });

  // ─────────────────────────────────────────────────────────────────
  // DEPLOYMENT
  // ─────────────────────────────────────────────────────────────────
  describe("Deployment", function () {

    it("should set the correct oracle address", async function () {
      expect(await contract.oracle()).to.equal(oracle.address);
    });

  });

  // ─────────────────────────────────────────────────────────────────
  // registerOperator
  // ─────────────────────────────────────────────────────────────────
  describe("registerOperator", function () {

    it("should register a new operator successfully", async function () {
      await contract.connect(operator1).registerOperator("Operator One");

      const op = await contract.operators(operator1.address);
      expect(op.name).to.equal("Operator One");
      expect(op.registered).to.equal(true);
      expect(op.registeredAt).to.be.gt(0);
    });

    it("should emit OperatorRegistered event", async function () {
      await expect(contract.connect(operator1).registerOperator("Operator One"))
        .to.emit(contract, "OperatorRegistered")
        .withArgs(operator1.address, "Operator One");
    });

    it("should revert if operator is already registered", async function () {
      await contract.connect(operator1).registerOperator("Operator One");

      await expect(
        contract.connect(operator1).registerOperator("Operator One Again")
      ).to.be.revertedWith("Already registered");
    });

    it("should revert if name is empty", async function () {
      await expect(
        contract.connect(operator1).registerOperator("")
      ).to.be.revertedWith("Name can not be empty");
    });

    it("should allow multiple different operators to register", async function () {
      await contract.connect(operator1).registerOperator("Operator One");
      await contract.connect(operator2).registerOperator("Operator Two");

      const op1 = await contract.operators(operator1.address);
      const op2 = await contract.operators(operator2.address);

      expect(op1.name).to.equal("Operator One");
      expect(op2.name).to.equal("Operator Two");
    });

  });

  // ─────────────────────────────────────────────────────────────────
  // enrollDevice
  // ─────────────────────────────────────────────────────────────────
  describe("enrollDevice", function () {

    beforeEach(async function () {
      await contract.connect(operator1).registerOperator("Operator One");
    });

    it("should enroll a device successfully", async function () {
      await contract.connect(operator1).enrollDevice(DEVICE_ENDPOINT, DEVICE_TYPE);

      const device = await contract.devices(deviceId);
      expect(device.operator).to.equal(operator1.address);
      expect(device.wotEndpoint).to.equal(DEVICE_ENDPOINT);
      expect(device.deviceType).to.equal(DEVICE_TYPE);
      expect(device.accuracyScore).to.equal(50);
      expect(device.availabilityScore).to.equal(50);
      expect(device.active).to.equal(true);
      expect(device.totalReports).to.equal(0);
    });

    it("should emit DeviceEnrolled event", async function () {
      await expect(
        contract.connect(operator1).enrollDevice(DEVICE_ENDPOINT, DEVICE_TYPE)
      )
        .to.emit(contract, "DeviceEnrolled")
        .withArgs(deviceId, operator1.address, DEVICE_ENDPOINT);
    });

    it("should add deviceId to operatorDevices list", async function () {
      await contract.connect(operator1).enrollDevice(DEVICE_ENDPOINT, DEVICE_TYPE);

      const devices = await contract.getOperatorDevices(operator1.address);
      expect(devices.length).to.equal(1);
      expect(devices[0]).to.equal(deviceId);
    });

    it("should revert if caller is not a registered operator", async function () {
      await expect(
        contract.connect(stranger).enrollDevice(DEVICE_ENDPOINT, DEVICE_TYPE)
      ).to.be.revertedWith("Caller is not a registered operator");
    });

    it("should revert if device is already enrolled", async function () {
      await contract.connect(operator1).enrollDevice(DEVICE_ENDPOINT, DEVICE_TYPE);

      await expect(
        contract.connect(operator1).enrollDevice(DEVICE_ENDPOINT, DEVICE_TYPE)
      ).to.be.revertedWith("Device already enrolled");
    });

    it("should revert if endpoint is empty", async function () {
      await expect(
        contract.connect(operator1).enrollDevice("", DEVICE_TYPE)
      ).to.be.revertedWith("Endpoint can not be empty");
    });

    it("should allow enrolling multiple devices under the same operator", async function () {
      const endpoint2 = "http://192.168.1.11:8080/wot/sensor-02";
      const deviceId2 = ethers.keccak256(ethers.toUtf8Bytes(endpoint2));

      await contract.connect(operator1).enrollDevice(DEVICE_ENDPOINT, DEVICE_TYPE);
      await contract.connect(operator1).enrollDevice(endpoint2, DEVICE_TYPE);

      const devices = await contract.getOperatorDevices(operator1.address);
      expect(devices.length).to.equal(2);
      expect(devices[0]).to.equal(deviceId);
      expect(devices[1]).to.equal(deviceId2);
    });

  });

  // ─────────────────────────────────────────────────────────────────
  // submitAccuracyReport
  // ─────────────────────────────────────────────────────────────────
  describe("submitAccuracyReport", function () {

    const INITIAL_SCORE = 50n;

    beforeEach(async function () {
      await contract.connect(operator1).registerOperator("Operator One");
      await contract.connect(operator1).enrollDevice(DEVICE_ENDPOINT, DEVICE_TYPE);
    });

    it("should increase accuracy score on accurate report", async function () {
      await contract.connect(oracle).submitAccuracyReport(deviceId, true);

      const device = await contract.devices(deviceId);
      expect(device.accuracyScore).to.equal(INITIAL_SCORE + ACCURACY_REWARD);
    });

    it("should decrease accuracy score on inaccurate report", async function () {
      await contract.connect(oracle).submitAccuracyReport(deviceId, false);

      const device = await contract.devices(deviceId);
      expect(device.accuracyScore).to.equal(INITIAL_SCORE - ACCURACY_PENALTY);
    });

    it("should increment totalReports on each submission", async function () {
      await contract.connect(oracle).submitAccuracyReport(deviceId, true);
      await contract.connect(oracle).submitAccuracyReport(deviceId, false);

      const device = await contract.devices(deviceId);
      expect(device.totalReports).to.equal(2);
    });

    it("should emit AccuracyReported event", async function () {
      await expect(contract.connect(oracle).submitAccuracyReport(deviceId, true))
        .to.emit(contract, "AccuracyReported")
        .withArgs(deviceId, true, INITIAL_SCORE + ACCURACY_REWARD);
    });

    it("should not exceed score of 100", async function () {
      // Submit enough reports to saturate the score regardless of reward value
      const reportsNeeded = Math.ceil((100 - 50) / Number(ACCURACY_REWARD)) + 10;
      for (let i = 0; i < reportsNeeded; i++) {
        await contract.connect(oracle).submitAccuracyReport(deviceId, true);
      }

      const device = await contract.devices(deviceId);
      expect(device.accuracyScore).to.equal(100);
    });

    it("should not go below score of 0", async function () {
      // Submit enough reports to floor the score regardless of penalty value
      const reportsNeeded = Math.ceil(50 / Number(ACCURACY_PENALTY)) + 5;
      for (let i = 0; i < reportsNeeded; i++) {
        await contract.connect(oracle).submitAccuracyReport(deviceId, false);
      }

      const device = await contract.devices(deviceId);
      expect(device.accuracyScore).to.equal(0);
    });

    it("should revert if caller is not the oracle", async function () {
      await expect(
        contract.connect(stranger).submitAccuracyReport(deviceId, true)
      ).to.be.revertedWith("Caller is not the oracle");
    });

    it("should revert if device does not exist", async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));

      await expect(
        contract.connect(oracle).submitAccuracyReport(fakeId, true)
      ).to.be.revertedWith("Device does not exist");
    });

    it("should revert if device is inactive", async function () {
      await contract.connect(operator1).deactivateDevice(deviceId);

      await expect(
        contract.connect(oracle).submitAccuracyReport(deviceId, true)
      ).to.be.revertedWith("Device is not active");
    });

  });

  // ─────────────────────────────────────────────────────────────────
  // submitAvailabilityReport
  // ─────────────────────────────────────────────────────────────────
  describe("submitAvailabilityReport", function () {

    const INITIAL_SCORE = 50n;

    beforeEach(async function () {
      await contract.connect(operator1).registerOperator("Operator One");
      await contract.connect(operator1).enrollDevice(DEVICE_ENDPOINT, DEVICE_TYPE);
    });

    it("should increase availability score when device is online", async function () {
      await contract.connect(oracle).submitAvailabilityReport(deviceId, true);

      const device = await contract.devices(deviceId);
      expect(device.availabilityScore).to.equal(INITIAL_SCORE + AVAILABILITY_REWARD);
    });

    it("should decrease availability score when device is offline", async function () {
      await contract.connect(oracle).submitAvailabilityReport(deviceId, false);

      const device = await contract.devices(deviceId);
      expect(device.availabilityScore).to.equal(INITIAL_SCORE - AVAILABILITY_PENALTY);
    });

    it("should emit AvailabilityReported event", async function () {
      await expect(
        contract.connect(oracle).submitAvailabilityReport(deviceId, true)
      )
        .to.emit(contract, "AvailabilityReported")
        .withArgs(deviceId, true, INITIAL_SCORE + AVAILABILITY_REWARD);
    });

    it("should not exceed score of 100", async function () {
      const reportsNeeded = Math.ceil((100 - 50) / Number(AVAILABILITY_REWARD)) + 10;
      for (let i = 0; i < reportsNeeded; i++) {
        await contract.connect(oracle).submitAvailabilityReport(deviceId, true);
      }

      const device = await contract.devices(deviceId);
      expect(device.availabilityScore).to.equal(100);
    });

    it("should not go below score of 0", async function () {
      const reportsNeeded = Math.ceil(50 / Number(AVAILABILITY_PENALTY)) + 5;
      for (let i = 0; i < reportsNeeded; i++) {
        await contract.connect(oracle).submitAvailabilityReport(deviceId, false);
      }

      const device = await contract.devices(deviceId);
      expect(device.availabilityScore).to.equal(0);
    });

    it("should revert if caller is not the oracle", async function () {
      await expect(
        contract.connect(stranger).submitAvailabilityReport(deviceId, true)
      ).to.be.revertedWith("Caller is not the oracle");
    });

    it("should revert if device does not exist", async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));

      await expect(
        contract.connect(oracle).submitAvailabilityReport(fakeId, true)
      ).to.be.revertedWith("Device does not exist");
    });

    it("should revert if device is inactive", async function () {
      await contract.connect(operator1).deactivateDevice(deviceId);

      await expect(
        contract.connect(oracle).submitAvailabilityReport(deviceId, true)
      ).to.be.revertedWith("Device is not active");
    });

  });

  // ─────────────────────────────────────────────────────────────────
  // deactivateDevice
  // ─────────────────────────────────────────────────────────────────
  describe("deactivateDevice", function () {

    beforeEach(async function () {
      await contract.connect(operator1).registerOperator("Operator One");
      await contract.connect(operator1).enrollDevice(DEVICE_ENDPOINT, DEVICE_TYPE);
    });

    it("should deactivate a device successfully", async function () {
      await contract.connect(operator1).deactivateDevice(deviceId);

      const device = await contract.devices(deviceId);
      expect(device.active).to.equal(false);
    });

    it("should emit DeviceDeactivated event", async function () {
      await expect(contract.connect(operator1).deactivateDevice(deviceId))
        .to.emit(contract, "DeviceDeactivated")
        .withArgs(deviceId);
    });

    it("should revert if caller is not the device owner", async function () {
      await contract.connect(operator2).registerOperator("Operator Two");

      await expect(
        contract.connect(operator2).deactivateDevice(deviceId)
      ).to.be.revertedWith("Only the device owner can deactivate it");
    });

    it("should revert if device does not exist", async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));

      await expect(
        contract.connect(operator1).deactivateDevice(fakeId)
      ).to.be.revertedWith("Device does not exist");
    });

    it("should revert if device is already inactive", async function () {
      await contract.connect(operator1).deactivateDevice(deviceId);

      await expect(
        contract.connect(operator1).deactivateDevice(deviceId)
      ).to.be.revertedWith("Device is not active");
    });

  });

  // ─────────────────────────────────────────────────────────────────
  // getReputation
  // ─────────────────────────────────────────────────────────────────
  describe("getReputation", function () {

    const INITIAL_SCORE = 50n;

    beforeEach(async function () {
      await contract.connect(operator1).registerOperator("Operator One");
      await contract.connect(operator1).enrollDevice(DEVICE_ENDPOINT, DEVICE_TYPE);
    });

    it("should return correct initial scores", async function () {
      const [accuracy, availability, composite] =
        await contract.getReputation(deviceId);

      expect(accuracy).to.equal(INITIAL_SCORE);
      expect(availability).to.equal(INITIAL_SCORE);
      // (50 * 60 + 50 * 40) / 100 = 50
      expect(composite).to.equal(INITIAL_SCORE);
    });

    it("should return updated scores after reports", async function () {
      await contract.connect(oracle).submitAccuracyReport(deviceId, true);
      await contract.connect(oracle).submitAvailabilityReport(deviceId, false);

      const expectedAccuracy    = INITIAL_SCORE + ACCURACY_REWARD;
      const expectedAvailability = INITIAL_SCORE - AVAILABILITY_PENALTY;
      const expectedComposite   = (expectedAccuracy * 60n + expectedAvailability * 40n) / 100n;

      const [accuracy, availability, composite] =
        await contract.getReputation(deviceId);

      expect(accuracy).to.equal(expectedAccuracy);
      expect(availability).to.equal(expectedAvailability);
      expect(composite).to.equal(expectedComposite);
    });

    it("should revert if device does not exist", async function () {
      const fakeId = ethers.keccak256(ethers.toUtf8Bytes("non-existent"));

      await expect(
        contract.getReputation(fakeId)
      ).to.be.revertedWith("Device does not exist");
    });

  });

  // ─────────────────────────────────────────────────────────────────
  // getOperatorDevices
  // ─────────────────────────────────────────────────────────────────
  describe("getOperatorDevices", function () {

    beforeEach(async function () {
      await contract.connect(operator1).registerOperator("Operator One");
    });

    it("should return empty array for operator with no devices", async function () {
      const devices = await contract.getOperatorDevices(operator1.address);
      expect(devices.length).to.equal(0);
    });

    it("should return all device IDs for an operator", async function () {
      const endpoint2 = "http://192.168.1.11:8080/wot/sensor-02";
      const deviceId2 = ethers.keccak256(ethers.toUtf8Bytes(endpoint2));

      await contract.connect(operator1).enrollDevice(DEVICE_ENDPOINT, DEVICE_TYPE);
      await contract.connect(operator1).enrollDevice(endpoint2, DEVICE_TYPE);

      const devices = await contract.getOperatorDevices(operator1.address);
      expect(devices.length).to.equal(2);
      expect(devices[0]).to.equal(deviceId);
      expect(devices[1]).to.equal(deviceId2);
    });

  });

});