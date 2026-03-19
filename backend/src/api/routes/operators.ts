import { ethers } from "ethers";
import * as path from "path";
import * as fs from "fs";
import { Request, Response, Router } from "express";

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

export const operatorsRouter = Router();

operatorsRouter.get('/:address/devices', async (req: Request, res: Response) => {
  try {
    const contract = getContract();
    const { address } = req.params;

    if (!ethers.isAddress(address)) {
      return res.status(400).json({ error: "Invalid Ethereum address" });
    }

    const deviceIds: string[] = await contract.getOperatorDevices(address);
    
    const devices = await Promise.all(deviceIds.map(async (deviceId) => {
      const device = await contract.devices(deviceId);
      const [accuracy, availability, composite] = 
        await contract.getReputation(deviceId);

      return {
        deviceId,
        wotEndpoint: device.wotEndpoint,
        deviceType: device.deviceType,
        accuracyScore: Number(accuracy),
        availabilityScore: Number(availability),
        compositeScore: Number(composite),
        totalReports: Number(device.totalReports),
        active: device.active,
      };
    })
  );
    res.json({ operator: address, devices })
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  } 
});