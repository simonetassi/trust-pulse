import Servient from "@node-wot/core";
import { ContractService } from "./ContractService";
import { HttpClientFactory } from "@node-wot/binding-http";

export class DeviceMonitor {
  private deviceId: string;
  private servient: Servient;
  private thing: any = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;
  private isActive: boolean = true;

  private dynamicIntervalMs: number = 15000;
  private readonly HEARTBEAT_MULTIPLIER = 1.5;

  private processedEpochs: Set<number> = new Set();
  private consecutiveMisses: number = 0;
  private readonly MAX_CONSECUTIVE_MISSES = 3; 

  public constructor(
    private wotEndpoint: string, 
    private contractService: ContractService
  ) {
      this.deviceId = ContractService.computeDeviceId(wotEndpoint);
      this.servient = new Servient();
      this.servient.addClientFactory(new HttpClientFactory);
  }

  private getCurrentEpoch(): number {
    return Math.floor(Date.now() / this.dynamicIntervalMs);
  }

  public async start(): Promise<void> {
    const WoT = await this.servient.start();
    this.isRunning = true;

    console.log(`[DeviceMonitor ${this.wotEndpoint}] Fetching Thing Description...`);

    const td = await WoT.requestThingDescription(this.wotEndpoint);
    this.thing = await WoT.consume(td);

    try {
      const rawInterval = await this.thing.readProperty('heartbeatInterval');
      this.dynamicIntervalMs = await rawInterval.value();
      console.log(`[DeviceMonitor ${this.wotEndpoint}] Bound heartbeat interval to ${this.dynamicIntervalMs}ms`);
    } catch (error) {
      console.warn(`[DeviceMonitor ${this.wotEndpoint}] Failed to read heartbeatInterval. Falling back to 15s.`);
    }

    console.log(`[DeviceMonitor ${this.wotEndpoint}] Connected. Starting Monitoring`);

    this.resetHeartbeatTimeout();

    await this.thing.subscribeEvent('heartbeat', async (data: any) => {
      if(!this.isRunning || !this.isActive) return;

      let eventId: number;
      try {
        const payload = await data.value();
        eventId = typeof payload?.eventId === 'number' ? payload.eventId : this.getCurrentEpoch();
      } catch {
        eventId = this.getCurrentEpoch();
      }

      if (this.processedEpochs.has(eventId)) {
        console.log(`[DeviceMonitor] Ignored duplicate heartbeat for eventId ${eventId}`);
        return;
      }

      this.processedEpochs.add(eventId);
      this.consecutiveMisses = 0;
      this.cleanupMemory();

      console.log(`[DeviceMonitor] ${this.wotEndpoint} Heartbeat received. EventId: ${eventId}`);
      this.resetHeartbeatTimeout();

      await this.contractService.submitAvailabilityReport(this.deviceId, true, eventId);
      await this.evaluateAccuracy(eventId);
    });
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;

    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
    
    if (this.thing) {
      try { await this.thing.unsubscribeEvent("heartbeat"); } catch {}
    }

    await this.servient.shutdown();
    console.log(`[DeviceMonitor ${this.wotEndpoint}] Stopped`);
  }

  public markInactive(): void {
    console.log(`[DeviceMonitor ${this.wotEndpoint}] Marked as inactive`);
    this.isActive = false;
    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) clearTimeout(this.heartbeatTimeout);

    const timeoutThreshold = this.dynamicIntervalMs * this.HEARTBEAT_MULTIPLIER;

    this.heartbeatTimeout = setTimeout(async () => {
      if(!this.isRunning || !this.isActive) return;

      const missedEpochId = this.getCurrentEpoch();

      if (this.processedEpochs.has(missedEpochId)) return;

      if (this.consecutiveMisses >= this.MAX_CONSECUTIVE_MISSES) {
         console.warn(`[DeviceMonitor] Device offline for too long. Suspending penalties to save gas.`);
         return; 
      }

      this.processedEpochs.add(missedEpochId);
      this.consecutiveMisses++;
      this.cleanupMemory();

      console.warn(`[DeviceMonitor] Heartbeat timeout. Penalizing Epoch: ${missedEpochId}`);

      await this.contractService.submitAvailabilityReport(this.deviceId, false, missedEpochId);

      this.resetHeartbeatTimeout();
    }, timeoutThreshold); 
  }

  private async evaluateAccuracy(epochId: number): Promise<void> {
    try {
      let accurate = true;
      const td = await this.thing.getThingDescription();

      if (!td.properties) return;

      for (const propName of Object.keys(td.properties)) {
        const propSchema = td.properties[propName];

        if (propSchema.type === 'number' || propSchema.type === 'integer') {
          let value: number;
          try {
            const rawValue = await this.thing.readProperty(propName);
            value = await rawValue.value(); 
          } catch (validationError: any) {
            accurate = false;
            continue;
          }

          if (propSchema.minimum !== undefined && value < propSchema.minimum) accurate = false;
          if (propSchema.maximum !== undefined && value > propSchema.maximum) accurate = false;
        }
      }

      await this.contractService.submitAccuracyReport(this.deviceId, accurate, epochId);
      
    } catch (error) {
      console.error(`[DeviceMonitor ${this.wotEndpoint}] Failed to evaluate accuracy:`, error);
    }
  }

  private cleanupMemory() {
    if (this.processedEpochs.size > 20) {
      const epochs = Array.from(this.processedEpochs).sort();
      this.processedEpochs = new Set(epochs.slice(-5));
    }
  }
}