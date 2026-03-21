import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const deploymentsPath = path.join(__dirname, "../../deployments.json");

const devices = [
  {
    wotEndpoint: "http://localhost:8081/sensor-01",
    deviceType: "temperature-humidity-sensor"
  },
  {
    wotEndpoint: "http://localhost:8082/sensor-02",
    deviceType: "temperature-humidity-sensor"
  },
  {
    wotEndpoint: "http://localhost:8083/sensor-03",
    deviceType: "temperature-humidity-sensor"
  }
];

async function main() {
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const contractAddress = deployments["localhost"]?.ChainReputation;

  if (!contractAddress) {
    throw new Error("No localhost deployment found. Run the deploy script first.");
  }

  // account[0] is the deployer, account[1] is the oracle
  // account[2] is the operator
  const [, , operator] = await ethers.getSigners();

  const contract = await ethers.getContractAt(
    "ChainReputation",
    contractAddress,
    operator
  );

  console.log(`Operator address: ${operator.address}`);
  console.log(`Contract address: ${contractAddress}`);

  console.log("\nRegistering operator...");
  const tx1 = await contract.registerOperator("TrustPulse Demo Operator");
  await tx1.wait();
  console.log("Operator registered.");

  for (const device of devices) {
    const deviceId = ethers.keccak256(ethers.toUtf8Bytes(device.wotEndpoint));
    console.log(`\nEnrolling ${device.wotEndpoint}...`);
    console.log(`deviceId: ${deviceId}`);

    const tx = await contract.enrollDevice(device.wotEndpoint, device.deviceType);
    await tx.wait();
    console.log(`Enrolled.`);
  }

  console.log("\nSetup complete. All devices enrolled on-chain.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });