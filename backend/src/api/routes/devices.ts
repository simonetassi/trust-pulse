import { ethers } from "ethers";
import { Router, Request, Response } from "express";
import * as fs from "fs";
import * as path from "path";

const artifactPath = path.join(__dirname, "../../../../blockchain/artifacts/contracts/ChainReputation.sol/ChainReputation.json");
const deploymentsPath = path.join(__dirname, "../../../../deployments.json");

function getContract(): ethers.Contract {
    const network = process.env.NETWORK ?? 'localhost';
    const rpcUrl = process.env.RPC_URL ?? 'http://127.0.0.1:8545';

    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
    const deployments = JSON.parse(fs.readFileSync(deploymentsPath, 'utf-8'));

    const contractAddress = deployments[network]?.ChainReputation;

    const provider = new ethers.JsonRpcProvider(rpcUrl);
    
    return new ethers.Contract(contractAddress, artifact.abi, provider);
}

export const devicesRouter = Router();

// GET REPUTATION
devicesRouter.get('/:deviceId/reputation', async (req: Request, res: Response) => {
  try {
    const contract = getContract();
    const { deviceId } = req.params;

    const [accuracy, availability, composite] = await contract.getReputation(deviceId);
    
    res.json({
      deviceId,
      accuracy: Number(accuracy),
      availability: Number(availability),
      composite: Number(composite)
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// GET DEVICE
devicesRouter.get('/:deviceId', async (req: Request, res: Response) => {
  try {
    const contract = getContract();
    const { deviceId } = req.params;

    const device = await contract.devices(deviceId);

    if (device.registeredAt === 0n) {
      return res.status(404).json({ error: "Device not found" });
    }

    res.json({
      deviceId,
      operator: device.operator,
      wotEndpoint: device.wotEndpoint,
      deviceType: device.deviceType,
      accuracyScore: Number(device.accuracyScore),
      availabilityScore: Number(device.availabilityScore),
      totalReports: Number(device.totalReports),
      registeredAt: Number(device.registeredAt),
      active: device.active,
    })
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
})

// GET HISTORY
devicesRouter.get('/:deviceId/history', async (req: Request, res: Response) => {
  try {  
    const contract = getContract();
    const { deviceId } = req.params;

    const accuracyFilter = contract.filters.AccuracyReported(deviceId);
    const availabilityFilter = contract.filters.AvailabilityReported(deviceId);

    // querying from block 0 to get all events
    const [accuracyEvents, availabilityEvents] = await Promise.all([
      contract.queryFilter(accuracyFilter, 0),
      contract.queryFilter(availabilityFilter, 0)
    ]);

    const history = [
      ...accuracyEvents.map((event: any) => ({
        type: 'accuracy',
        accurate: event.args.accurate,
        newScore: Number(event.args.newScore),
        blockNumber: event.blockNumber,
        txHash: event.transactionHash,
      })),
      ...availabilityEvents.map((event: any) => ({
        type: 'availability',
        available: event.args.available,
        newScore: Number(event.args.newScore),
        blockNumber: event.blockNumber,
        txHash: event.transactionHash,
      }))
    ].sort((a, b) => (a.blockNumber - b.blockNumber));

    res.json({ deviceId, history });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
})