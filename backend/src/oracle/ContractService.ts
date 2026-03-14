import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";

const artifactPath = path.join(
  __dirname,
  "../../../blockchain/artifacts/contracts/ChainReputation.sol/ChainReputation.json"
);

const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf8"));

const deploymentsPath = path.join(__dirname, "../../../deployments.json");

function loadContractAddress(network: string): string {
  const deployments = JSON.parse(fs.readFileSync(deploymentsPath, "utf-8"));
  const address = deployments[network]?.ChainReputation;
  if (!address) throw new Error(`No deployment found for network: ${network}`);
  return address;
}

export class ContractService {
  private contract: ethers.Contract;
  private oracleWallet: ethers.Wallet;
  private provider: ethers.JsonRpcProvider;

  public constructor() {
    const rpcUrl = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
    const network = process.env.NETWORK ?? 'localhost';
    const oraclePrivateKey = process.env.ORACLE_PRIVATE_KEY;

    if (!oraclePrivateKey) {
      throw new Error("ORACLE_PRIVATE_KEY is not set in .env");
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    this.oracleWallet = new ethers.Wallet(oraclePrivateKey, this.provider);

    const contractAddress = loadContractAddress(network);

    this.contract = new ethers.Contract(contractAddress, artifact.abi, this.oracleWallet);

    console.log(`Connected to contract at ${contractAddress}`);
  }

  // TODO add queuing to mitigate nonce conflict

  public async submitAccuracyReport(deviceId: string, accurate: boolean): Promise<void> {
    try {
      const tx = await this.contract.submitAccuracyReport(deviceId, accurate);
      await tx.wait();

      console.log(`Accuracy report submitted` +
        `deviceId: ${deviceId.slice(0, 10)}... accurate: ${accurate} tx: ${tx.hash}`
      );
    } catch (error) {
      console.error('Failed to submit accuracy report: ' + error);
    }
  }

  public async submitAvailabilityReport(deviceId: string, available: boolean): Promise<void> {
    try {
      const tx = await this.contract.submitAvaialabilityReport(deviceId, available);
      await tx.wait();

      console.log(`Availability report submitted` +
        `deviceId: ${deviceId.slice(0, 10)}... available: ${available} tx: ${tx.hash}`
      );
    } catch (error) {
      console.error('Failed to submit availability report: ' + error);
    }
  }

  public async getReputation(deviceId: string): Promise<{
    accuracy: bigint;
    availability: bigint;
    composite: bigint;
  }> {
    const [accuracy, availability, composite] = await this.contract.getReputation(deviceId);
    return { accuracy, availability, composite }
  }

  public static computeDeviceId(wotEndpoint: string): string {
    return ethers.keccak256(ethers.toUtf8Bytes(wotEndpoint));
  }
}

