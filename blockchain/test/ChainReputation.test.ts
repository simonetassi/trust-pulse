import { expect } from "chai";
import { ethers } from "hardhat";
import { ChainReputation } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("ChainReputation - Event-Based DON Architecture", function () {

  let contract: ChainReputation;
  let admin: SignerWithAddress;
  let oracle1: SignerWithAddress;
  let oracle2: SignerWithAddress;
  let oracle3: SignerWithAddress;
  
  let operator1: SignerWithAddress;
  let stranger: SignerWithAddress;

  let ACCURACY_REWARD: bigint;
  let ACCURACY_PENALTY: bigint;
  let AVAILABILITY_REWARD: bigint;
  let AVAILABILITY_PENALTY: bigint;

  const DEVICE_ENDPOINT = "http://192.168.1.10:8080/wot/sensor-01";
  const DEVICE_TYPE = "temperature-sensor";
  const deviceId = ethers.keccak256(ethers.toUtf8Bytes(DEVICE_ENDPOINT));

  beforeEach(async function () {
    [admin, oracle1, oracle2, oracle3, operator1, stranger] = await ethers.getSigners();
    
    const Factory = await ethers.getContractFactory("ChainReputation");
    contract = await Factory.deploy() as ChainReputation;

    // Setup Oracle Network
    await contract.connect(admin).addOracle(oracle1.address);
    await contract.connect(admin).addOracle(oracle2.address);
    await contract.connect(admin).addOracle(oracle3.address);
    await contract.connect(admin).setQuorum(2);

    ACCURACY_REWARD      = await contract.ACCURACY_REWARD();
    ACCURACY_PENALTY     = await contract.ACCURACY_PENALTY();
    AVAILABILITY_REWARD  = await contract.AVAILABILITY_REWARD();
    AVAILABILITY_PENALTY = await contract.AVAILABILITY_PENALTY();
  });

  // ─────────────────────────────────────────────────────────────────
  // DEPLOYMENT & ADMIN
  // ─────────────────────────────────────────────────────────────────
  describe("Deployment & Oracle Administration", function () {

    it("should set the correct admin address", async function () {
      expect(await contract.admin()).to.equal(admin.address);
    });

    it("should allow admin to add oracles and set quorum", async function () {
      expect(await contract.authorizedOracles(oracle1.address)).to.be.true;
      expect(await contract.quorum()).to.equal(2);
      expect(await contract.oracleCount()).to.equal(3);
    });

    it("should allow admin to remove oracles and adjust quorum dynamically", async function () {
      await contract.connect(admin).removeOracle(oracle3.address);
      expect(await contract.authorizedOracles(oracle3.address)).to.be.false;
      expect(await contract.oracleCount()).to.equal(2);
    });

    it("should revert if a non-admin tries to configure oracles", async function () {
      await expect(
        contract.connect(stranger).addOracle(stranger.address)
      ).to.be.revertedWith("Caller is not the admin");
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // registerOperator & enrollDevice
  // ─────────────────────────────────────────────────────────────────
  describe("Operator & Device Onboarding", function () {
    it("should register a new operator successfully", async function () {
      await expect(contract.connect(operator1).registerOperator("Operator One"))
        .to.emit(contract, "OperatorRegistered")
        .withArgs(operator1.address, "Operator One");
    });

    it("should enroll a device successfully", async function () {
      await contract.connect(operator1).registerOperator("Operator One");
      await expect(contract.connect(operator1).enrollDevice(DEVICE_ENDPOINT, DEVICE_TYPE))
        .to.emit(contract, "DeviceEnrolled")
        .withArgs(deviceId, operator1.address, DEVICE_ENDPOINT);

      const device = await contract.devices(deviceId);
      expect(device.accuracyScore).to.equal(50);
      expect(device.availabilityScore).to.equal(50);
      expect(device.active).to.equal(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // DON CONSENSUS: Event-Based Reporting
  // ─────────────────────────────────────────────────────────────────
  describe("Consensus Reporting (Event-Based & Quorum)", function () {
    const INITIAL_SCORE = 50n;
    const EVENT_ID_1 = 1001;
    const EVENT_ID_2 = 1002;

    beforeEach(async function () {
      await contract.connect(operator1).registerOperator("Operator One");
      await contract.connect(operator1).enrollDevice(DEVICE_ENDPOINT, DEVICE_TYPE);
    });

    it("should NOT update accuracy score if quorum is not reached for an event", async function () {
      await contract.connect(oracle1).submitAccuracyReport(deviceId, true, EVENT_ID_1);
      
      const device = await contract.devices(deviceId);
      expect(device.accuracyScore).to.equal(INITIAL_SCORE); 
    });

    it("should update accuracy score exactly when quorum is reached for an event", async function () {
      // 1st Vote - No update
      await contract.connect(oracle1).submitAccuracyReport(deviceId, true, EVENT_ID_1);
      
      // 2nd Vote - Quorum reached, update triggers
      const tx = await contract.connect(oracle2).submitAccuracyReport(deviceId, true, EVENT_ID_1);
      
      await expect(tx)
        .to.emit(contract, "AccuracyReported")
        .withArgs(deviceId, true, INITIAL_SCORE + ACCURACY_REWARD);

      const device = await contract.devices(deviceId);
      expect(device.accuracyScore).to.equal(INITIAL_SCORE + ACCURACY_REWARD);
    });

    it("should not double-apply the score update if a third oracle votes on the same event", async function () {
      await contract.connect(oracle1).submitAccuracyReport(deviceId, true, EVENT_ID_1);
      await contract.connect(oracle2).submitAccuracyReport(deviceId, true, EVENT_ID_1);
      
      // 3rd Vote on same event should be recorded, but score should NOT increase again
      await contract.connect(oracle3).submitAccuracyReport(deviceId, true, EVENT_ID_1);
      
      const device = await contract.devices(deviceId);
      expect(device.accuracyScore).to.equal(INITIAL_SCORE + ACCURACY_REWARD);
    });

    it("should revert if an oracle tries to vote twice on the same event", async function () {
      await contract.connect(oracle1).submitAccuracyReport(deviceId, true, EVENT_ID_1);
      
      await expect(
        contract.connect(oracle1).submitAccuracyReport(deviceId, true, EVENT_ID_1)
      ).to.be.revertedWith("Oracle already voted for this event");
    });

    it("should allow sequential score updates across different eventIds", async function () {
      // Event 1 (Negative impact)
      await contract.connect(oracle1).submitAccuracyReport(deviceId, false, EVENT_ID_1);
      await contract.connect(oracle2).submitAccuracyReport(deviceId, false, EVENT_ID_1);
      
      let device = await contract.devices(deviceId);
      expect(device.accuracyScore).to.equal(INITIAL_SCORE - ACCURACY_PENALTY);

      // Event 2 (Negative impact)
      await contract.connect(oracle1).submitAccuracyReport(deviceId, false, EVENT_ID_2);
      await contract.connect(oracle2).submitAccuracyReport(deviceId, false, EVENT_ID_2);
      
      device = await contract.devices(deviceId);
      expect(device.accuracyScore).to.equal(INITIAL_SCORE - (ACCURACY_PENALTY * 2n));
    });

    it("should not exceed max score of 100", async function () {
      const reportsNeeded = Math.ceil((100 - 50) / Number(ACCURACY_REWARD)) + 5;
      
      // Loop through multiple unique events
      for (let i = 1; i <= reportsNeeded; i++) {
        await contract.connect(oracle1).submitAccuracyReport(deviceId, true, i);
        await contract.connect(oracle2).submitAccuracyReport(deviceId, true, i);
      }

      const device = await contract.devices(deviceId);
      expect(device.accuracyScore).to.equal(100);
    });
  });

  // ─────────────────────────────────────────────────────────────────
  // getReputation & Deactivation
  // ─────────────────────────────────────────────────────────────────
  describe("Device State and Reputation Retrieval", function () {
    const INITIAL_SCORE = 50n;
    const EVENT_ID = 999;

    beforeEach(async function () {
      await contract.connect(operator1).registerOperator("Operator One");
      await contract.connect(operator1).enrollDevice(DEVICE_ENDPOINT, DEVICE_TYPE);
    });

    it("should return correct composite scores after mixed event reports", async function () {
      // Event 1: Accuracy goes UP
      await contract.connect(oracle1).submitAccuracyReport(deviceId, true, EVENT_ID);
      await contract.connect(oracle2).submitAccuracyReport(deviceId, true, EVENT_ID);

      // Event 1: Availability goes DOWN
      await contract.connect(oracle2).submitAvailabilityReport(deviceId, false, EVENT_ID);
      await contract.connect(oracle3).submitAvailabilityReport(deviceId, false, EVENT_ID);

      const expectedAccuracy    = INITIAL_SCORE + ACCURACY_REWARD;
      const expectedAvailability = INITIAL_SCORE - AVAILABILITY_PENALTY;
      const expectedComposite   = (expectedAccuracy * 60n + expectedAvailability * 40n) / 100n;

      const [accuracy, availability, composite] = await contract.getReputation(deviceId);

      expect(accuracy).to.equal(expectedAccuracy);
      expect(availability).to.equal(expectedAvailability);
      expect(composite).to.equal(expectedComposite);
    });

    it("should prevent oracle reports on deactivated devices", async function () {
      await contract.connect(operator1).deactivateDevice(deviceId);
      
      await expect(
        contract.connect(oracle1).submitAccuracyReport(deviceId, true, EVENT_ID)
      ).to.be.revertedWith("Device is not active");
    });
  });
});