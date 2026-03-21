import { ethers } from "ethers";
import * as fs from "fs";
import * as path from "path";
import { Server as SocketServer } from "socket.io";

const artifactPath = path.join(__dirname, "../../../../blockchain/artifacts/contracts/ChainReputation.sol/ChainReputation.json");
const deploymentsPath = path.join(__dirname, "../../../../deployments.json");


export class ContractEventListener {
  private contract: ethers.Contract;

  public constructor(private io: SocketServer) {
    const network = process.env.NETWORK ?? 'localhost';
    const rpcUrl = process.env.RPC_URL ?? 'http://127.0.0.1:8545';

    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf-8'));

    const contractAddress = deployments[network]?.ChainReputation;

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    this.contract = new ethers.Contract(contractAddress, artifact.abi, provider);
  }

  public start(): void {
    this.contract.on('AccuracyReported', (deviceId, accurate, accScore, event) => {
      const payload = {
        deviceId,
        accurate,
        newAccuracyScore: Number(accScore), // serializing from BigInt to Number
        timestamp: Date.now(),
        txHash: event.log.transactionHash,
      };

      console.log(`[ContractEventListener] AccuracyReported:`, payload);
      this.io.emit('accuracy:report', payload);
    });

    this.contract.on('AvailabilityReported', (deviceId, available, avScore, event) => {
      const payload = {
        deviceId,
        available,
        newAvailabilityScore: Number(avScore),
        timestamp: Date.now(),
        txHash: event.log.transactionHash,
      };

      console.log(`[ContractEventListener] AvailabilityReported:`, payload);
      this.io.emit('availability:report', payload);
    });

    this.contract.on('DeviceDeactivated', (deviceId, event) => {
      const payload = {
        deviceId,
        timestamp: Date.now(),
        txHash: event.log.transactionHash
      };

      console.log(`[ContractEventListener] DeviceDeactivated:`, payload);
      this.io.emit('device:deactivated', payload);
    });
  }

  public async stop(): Promise<void> {
    await this.contract.removeAllListeners();
    console.log("[ContractEventListener] Stopped.");
  }
}