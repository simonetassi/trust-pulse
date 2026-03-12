import { ethers, network } from "hardhat";
import { saveAddress } from "./helpers/addresses";

async function main() {
  console.log(`\nDeploying to network: ${network.name}`);
  console.log("─".repeat(40));

  const [deployer] = await ethers.getSigners();

  let oracleAddress: string;

  if (network.name === "localhost" || network.name === "hardhat") {
    const accounts = await ethers.getSigners();
    oracleAddress = accounts[1].address; // use the second account leaving index 0 as the general deployer
    console.log(`Oracle address (local account #1): ${oracleAddress}`);
  } else {
    const oracleFromEnv = process.env.ORACLE_ADDRESS;
    if (!oracleFromEnv) {
      throw new Error("ORACLE_ADDRESS is not set in .env for non-local deployment");
    }
    oracleAddress = oracleFromEnv;
    console.log(`Oracle address (from .env): ${oracleAddress}`);
  }

  console.log(`Deployer address:           ${deployer.address}`);
  console.log(`Deployer balance:           ${ethers.formatEther(
    await ethers.provider.getBalance(deployer.address)
  )} ETH`);

  // DEPLOY
  console.log("\nDeploying ChainReputation...");

  const Factory = await ethers.getContractFactory("ChainReputation");
  const contract = await Factory.deploy(oracleAddress);

  await contract.waitForDeployment();

  const contractAddress = await contract.getAddress();

  console.log(`ChainReputation deployed to: ${contractAddress}`);

  // SAVE ADDRESS
  saveAddress(network.name, "ChainReputation", contractAddress);
  console.log(`Address saved to deployments.json`);

  // CONSTANTS
  console.log("\nContract constants:");
  console.log(`  ACCURACY_REWARD:      ${await contract.ACCURACY_REWARD()}`);
  console.log(`  ACCURACY_PENALTY:     ${await contract.ACCURACY_PENALTY()}`);
  console.log(`  AVAILABILITY_REWARD:  ${await contract.AVAILABILITY_REWARD()}`);
  console.log(`  AVAILABILITY_PENALTY: ${await contract.AVAILABILITY_PENALTY()}`);

  console.log("\nDeployment complete.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });