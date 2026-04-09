import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

const deploymentsPath = process.env.DEPLOYMENTS_PATH
  || path.join(__dirname, "../../../deployments.json");

const devices = [
  {
    wotEndpoint: "http://wot-network:8081/sensor-01",
    deviceType: "temperature-humidity-sensor"
  },
  {
    wotEndpoint: "http://wot-network:8082/sensor-02",
    deviceType: "temperature-humidity-sensor"
  },
  {
    wotEndpoint: "http://wot-network:8083/sensor-03",
    deviceType: "temperature-humidity-sensor"
  }
];

async function main() {
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf8"));
  const contractAddress = deployments["localhost"]?.ChainReputation;

  if (!contractAddress) {
    throw new Error("No localhost deployment found. Run the deploy script first.");
  }

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

  // ─── Sync artifacts ───────────────────────────────────────────

  // Frontend assets — files land flat at this path
  // In Docker: FRONTEND_ASSETS_PATH=/shared
  // Locally:   frontend/src/assets
  const frontendAssetsDir = process.env.FRONTEND_ASSETS_PATH
    || path.join(__dirname, "../../../frontend/src/assets");

  // Backend artifacts — ABI lands here
  // In Docker: BACKEND_ARTIFACTS_PATH=/shared/artifacts
  // Locally:   blockchain/artifacts (already exists, no copy needed)
  const backendArtifactsDir = process.env.BACKEND_ARTIFACTS_PATH
    || path.join(__dirname, "../artifacts");

  const abiSourcePath = path.join(
    __dirname,
    "../artifacts/contracts/ChainReputation.sol/ChainReputation.json"
  );

  console.log(`\nSync paths:`);
  console.log(`  deploymentsPath:    ${deploymentsPath}`);
  console.log(`  frontendAssetsDir:  ${frontendAssetsDir}`);
  console.log(`  backendArtifactsDir: ${backendArtifactsDir}`);
  console.log(`  abiSourcePath:      ${abiSourcePath}`);

  // Verify ABI source exists
  if (!fs.existsSync(abiSourcePath)) {
    throw new Error(`ABI source not found at ${abiSourcePath}. Run npx hardhat compile first.`);
  }

  // Create directories
  fs.mkdirSync(frontendAssetsDir, { recursive: true });

  const backendAbiDir = path.join(
    backendArtifactsDir,
    "contracts/ChainReputation.sol"
  );
  fs.mkdirSync(backendAbiDir, { recursive: true });

  // Copy deployments.json → frontend assets (flat)
  const destDeployments = path.join(frontendAssetsDir, "deployments.json");
  fs.copyFileSync(deploymentsPath, destDeployments);
  console.log(`\nCopied deployments.json → ${destDeployments}`);

  // Copy ABI → frontend assets (flat)
  const destAbiFrontend = path.join(frontendAssetsDir, "ChainReputation.json");
  fs.copyFileSync(abiSourcePath, destAbiFrontend);
  console.log(`Copied ABI → ${destAbiFrontend}`);

  // Copy ABI → backend artifacts
  const destAbiBackend = path.join(
    backendAbiDir,
    "ChainReputation.json"
  );
  fs.copyFileSync(abiSourcePath, destAbiBackend);
  console.log(`Copied ABI → ${destAbiBackend}`);

  // Verify all files landed correctly
  console.log(`\nVerification:`);
  console.log(`  ${destDeployments}: ${fs.existsSync(destDeployments)}`);
  console.log(`  ${destAbiFrontend}: ${fs.existsSync(destAbiFrontend)}`);
  console.log(`  ${destAbiBackend}: ${fs.existsSync(destAbiBackend)}`);

  // List final contents of frontend assets dir
  console.log(`\nFrontend assets contents:`);
  console.log(fs.readdirSync(frontendAssetsDir));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });