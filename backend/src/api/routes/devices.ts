import { Router, Request, Response } from "express";
import { getContract } from "../contractProvider";

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