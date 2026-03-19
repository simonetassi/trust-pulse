import { ethers, NonceManager } from "ethers";
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
  private provider: ethers.JsonRpcProvider;
  private nonceManager: NonceManager; // ensuring nonce consistency
  private txQueue: Promise<void> = Promise.resolve();

  public constructor() {
    const rpcUrl = process.env.RPC_URL ?? 'http://127.0.0.1:8545';
    const network = process.env.NETWORK ?? 'localhost';
    const oraclePrivateKey = process.env.ORACLE_PRIVATE_KEY;

    if (!oraclePrivateKey) {
      throw new Error("ORACLE_PRIVATE_KEY is not set in .env");
    }

    this.provider = new ethers.JsonRpcProvider(rpcUrl);
    const oracleWallet = new ethers.Wallet(oraclePrivateKey, this.provider);
    this.nonceManager = new NonceManager(oracleWallet);

    const contractAddress = loadContractAddress(network);

    this.contract = new ethers.Contract(contractAddress, artifact.abi, this.nonceManager);

    console.log(`Connected to contract at ${contractAddress}`);
  }

  // ensuring nonce consistency
  private enqueue(
    fnName: string,
    deviceId: string,
    fn: () => Promise<void>
  ): Promise<void> {
    const next = this.txQueue.then(fn).catch((error) => {
      console.error(
        `[ContractService] ${fnName} failed for ` +
        `deviceId ${deviceId.slice(0, 10)}...:`,
        error.message ?? error
      );
    });

    this.txQueue = next;
    return next;
  }

  public async submitAccuracyReport(deviceId: string, accurate: boolean): Promise<void> {
    this.enqueue('submitAccuracyReport', deviceId, async () => {
      const tx = await this.contract.submitAccuracyReport(deviceId, accurate);
      await tx.wait();

      console.log(`Accuracy report submitted ` +
        `deviceId: ${deviceId.slice(0, 10)}... accurate: ${accurate} tx: ${tx.hash}`
      );
    })
  }

  public async submitAvailabilityReport(deviceId: string, available: boolean): Promise<void> {
    this.enqueue('submitAvailabilityReport', deviceId, async () => {
      const tx = await this.contract.submitAvailabilityReport(deviceId, available);
      await tx.wait();

      console.log(`Availability report submitted ` +
        `deviceId: ${deviceId.slice(0, 10)}... available: ${available} tx: ${tx.hash}`
      );
    })
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

