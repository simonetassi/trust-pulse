import { ethers, network } from "hardhat";
import { saveAddress } from "./helpers/addresses";

async function main() {
  console.log(`\nDeploying to network: ${network.name}`);
  console.log("─".repeat(40));

  const [deployer] = await ethers.getSigners();

  let oracleAddresses: string[] = [];

  if (network.name === "localhost" || network.name === "hardhat") {
    const accounts = await ethers.getSigners();
    oracleAddresses = [
      accounts[1].address,
      accounts[2].address,
      accounts[18].address
    ];
    console.log(`Oracles mapped to local accounts #1, #2, #18:`);
    oracleAddresses.forEach((addr, i) => console.log(`  Oracle ${i + 1}: ${addr}`));
  } else {
    const oracle1 = process.env.ORACLE_1_ADDRESS;
    const oracle2 = process.env.ORACLE_2_ADDRESS;
    const oracle3 = process.env.ORACLE_3_ADDRESS;
    
    if (!oracle1 || !oracle2 || !oracle3) {
      throw new Error("ORACLE_1_ADDRESS, ORACLE_2_ADDRESS, and ORACLE_3_ADDRESS must be set in .env for non-local deployment");
    }
    oracleAddresses = [oracle1, oracle2, oracle3];
    console.log(`Oracles mapped from .env variables:`);
    oracleAddresses.forEach((addr, i) => console.log(`  Oracle ${i + 1}: ${addr}`));
  }

  console.log(`\nDeployer (Admin) address:   ${deployer.address}`);
  console.log(`Deployer balance:           ${ethers.formatEther(
    await ethers.provider.getBalance(deployer.address)
  )} ETH`);

  console.log("\nDeploying ChainReputation...");
  const Factory = await ethers.getContractFactory("ChainReputation");
  const contract = await Factory.deploy();

  await contract.waitForDeployment();
  const contractAddress = await contract.getAddress();
  console.log(`ChainReputation deployed to: ${contractAddress}`);

  console.log("\nConfiguring Decentralized Oracle Network...");
  
  for (let i = 0; i < oracleAddresses.length; i++) {
    console.log(`  Authorizing Oracle ${i + 1}: ${oracleAddresses[i]}`);
    const tx = await contract.connect(deployer).addOracle(oracleAddresses[i]);
    await tx.wait();
  }

  console.log(`  Setting Quorum to 2...`);
  const quorumTx = await contract.connect(deployer).setQuorum(2);
  await quorumTx.wait();

  saveAddress(network.name, "ChainReputation", contractAddress);
  console.log(`\nAddress saved to deployments.json`);

  console.log("\nContract state & constants:");
  console.log(`  Admin:                ${await contract.admin()}`);
  console.log(`  Active Quorum:        ${await contract.quorum()}`);
  console.log(`  Total Oracles:        ${await contract.oracleCount()}`);
  console.log(`  ACCURACY_REWARD:      ${await contract.ACCURACY_REWARD()}`);
  console.log(`  ACCURACY_PENALTY:     ${await contract.ACCURACY_PENALTY()}`);
  console.log(`  AVAILABILITY_REWARD:  ${await contract.AVAILABILITY_REWARD()}`);
  console.log(`  AVAILABILITY_PENALTY: ${await contract.AVAILABILITY_PENALTY()}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });