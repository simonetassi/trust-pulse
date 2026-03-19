import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const artifactPath = path.join(
  __dirname,
  "../../../blockchain/artifacts/contracts/ChainReputation.sol/ChainReputation.json"
);
const deploymentsPath = path.join(__dirname, "../../../deployments.json");

let contractInstance: ethers.Contract | null = null;

export function getContract(): ethers.Contract {
  if (contractInstance) return contractInstance;

  const network = process.env.NETWORK ?? "localhost";
  const rpcUrl = process.env.RPC_URL ?? "http://127.0.0.1:8545";

  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Artifact not found at ${artifactPath}.`);
  }
  if (!fs.existsSync(deploymentsPath)) {
    throw new Error(`deployments.json not found.`);
  }

  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  const contractAddress = deployments[network]?.ChainReputation;

  if (!contractAddress) {
    throw new Error(`No ChainReputation address found for network "${network}"`);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  contractInstance = new ethers.Contract(contractAddress, artifact.abi, provider);

  console.log(`[ContractProvider] Initialized at ${contractAddress}`);
  return contractInstance;
}