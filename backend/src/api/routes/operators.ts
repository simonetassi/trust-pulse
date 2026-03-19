import { ethers } from "ethers";
import { Request, Response, Router } from "express";
import { getContract } from "../contractProvider";

export const operatorsRouter = Router();

// GET OPERATOR'S DEVICES
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