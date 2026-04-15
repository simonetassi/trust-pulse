import { Router, Request, Response } from "express";
import { getContract } from "../../shared/contractProvider";

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

    const [accuracy, availability, composite] =
      await contract.getReputation(deviceId);

    res.json({
      deviceId,
      operator: device.operator,
      wotEndpoint: device.wotEndpoint,
      deviceType: device.deviceType,
      accuracyScore: Number(accuracy),
      availabilityScore: Number(availability),
      compositeScore: Number(composite),
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

    const provider = contract.runner?.provider;
    if (!provider) {
      throw new Error("Blockchain provider is not initialized.");
    }

    const currentBlock = await provider.getBlockNumber();
    const network = await provider.getNetwork();
    const chainId = Number(network.chainId);

    let fromBlock: number;
    if (chainId === 31337) {
      fromBlock = 0;
    } else {
      fromBlock = Math.max(0, currentBlock - 9); // Sepolia / Public RPC: Strict 10-block limit
    }

    const accuracyFilter = contract.filters.AccuracyReported(deviceId);
    const availabilityFilter = contract.filters.AvailabilityReported(deviceId);

    const [accuracyEvents, availabilityEvents] = await Promise.all([
      contract.queryFilter(accuracyFilter, fromBlock, 'latest'),
      contract.queryFilter(availabilityFilter, fromBlock, 'latest')
    ]);

    const history = [
      ...accuracyEvents.map((event: any) => ({
        type: 'accuracy',
        accurate: Boolean(event.args.accurate),
        newScore: Number(event.args.newScore), 
        blockNumber: Number(event.blockNumber), 
        txHash: event.transactionHash,
      })),
      ...availabilityEvents.map((event: any) => ({
        type: 'availability',
        available: Boolean(event.args.available),
        newScore: Number(event.args.newScore), 
        blockNumber: Number(event.blockNumber), 
        txHash: event.transactionHash,
      }))
    ].sort((a, b) => a.blockNumber - b.blockNumber);

    res.json({ deviceId, history });
  } catch (error: any) {
    console.error(`[Device History Error - ${req.params.deviceId}]:`, error);
    res.status(500).json({ error: "Failed to fetch device history", details: error.message });
  }
});

// GET ALL DEVICES
devicesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const contract = getContract();
    
    const deviceIds: string[] = await contract.getAllDevices();
    
    const devices = await Promise.all(deviceIds.map(async (deviceId) => {
      const device = await contract.devices(deviceId);
      const [accuracy, availability, composite] = await contract.getReputation(deviceId);

      return {
        deviceId,
        operator: device.operator,
        wotEndpoint: device.wotEndpoint,
        deviceType: device.deviceType,
        accuracyScore: Number(accuracy),
        availabilityScore: Number(availability),
        compositeScore: Number(composite),
        totalReports: Number(device.totalReports),
        active: device.active,
      };
    }));

    res.json({ devices });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

devicesRouter.post('/validate-td', async (req: Request, res: Response) => {
  const { endpoint } = req.body;

  if (!endpoint) {
    return res.status(400).json({ valid: false, reason: "Endpoint URL is required." });
  }

  try {
    const response = await fetch(endpoint);
    
    if (!response.ok) {
      return res.status(400).json({ valid: false, reason: `HTTP Status: ${response.status}` });
    }

    const td = await response.json();

    if (!td || typeof td !== 'object' || !td.properties) {
      return res.status(400).json({ valid: false, reason: "Invalid TD: Missing 'properties' schema." });
    }

    const hbSchema = td.properties['heartbeatInterval'];
    if (!hbSchema) {
      return res.status(400).json({ valid: false, reason: "Invalid TD: Missing required 'heartbeatInterval' property." });
    }
    if (hbSchema.type !== 'number' && hbSchema.type !== 'integer') {
      return res.status(400).json({ valid: false, reason: "Invalid TD: 'heartbeatInterval' must be a numeric type." });
    }

    for (const [propName, propSchema] of Object.entries<any>(td.properties)) {
      if (propSchema.type === 'number' || propSchema.type === 'integer') {
        if (propName !== 'heartbeatInterval') {
          if (propSchema.minimum === undefined || propSchema.maximum === undefined) {
            return res.status(400).json({ valid: false, reason: `Invalid Schema: Numeric property '${propName}' is missing min/max bounds.` });
          }
          if (propSchema.minimum >= propSchema.maximum) {
            return res.status(400).json({ valid: false, reason: `Invalid Schema: '${propName}' min >= max.` });
          }
        }
      }
    }

    return res.json({ valid: true });

  } catch (error: any) {
    console.error("Backend TD Validation Error:", error.message);
    return res.status(500).json({ 
      valid: false, 
      reason: "Network error. Make sure the WoT device simulator is running and the URL is correct." 
    });
  }
});