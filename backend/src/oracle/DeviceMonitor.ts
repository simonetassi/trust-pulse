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
  private lastSeenEventId: number = 0;

  private dynamicIntervalMs: number = 15000;
  private readonly HEARTBEAT_MULTIPLIER = 1.5;

  public constructor(
    private wotEndpoint: string, 
    private contractService: ContractService
  ) {
      this.deviceId = ContractService.computeDeviceId(wotEndpoint);
      this.servient = new Servient();
      this.servient.addClientFactory(new HttpClientFactory);
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
      if(!this.isRunning) return;

      if (!this.isActive) {
        console.log(`[DeviceMonitor ${this.wotEndpoint}] Skipping — device is inactive`);
        return;
      }

      let payload: any;
      try {
        payload = await data.value();
      } catch (error) {
        console.error(`[DeviceMonitor] Failed to parse heartbeat data:`, error);
        return; 
      }

      const eventId = payload?.eventId ?? Math.floor(Date.now() / 1000);
      this.lastSeenEventId = eventId;

      console.log(`[DeviceMonitor] ${this.wotEndpoint} Heartbeat recevied`)
      console.log('eventId:', eventId);

      this.resetHeartbeatTimeout();

      await this.contractService.submitAvailabilityReport(this.deviceId, true, eventId);

      await this.evaluateAccuracy(eventId);
    })
  }

  public async stop(): Promise<void> {
    if (!this.isRunning) return;

    this.isRunning = false;

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null
    }

    if (this.thing) {
      try {
        await this.thing.unsubscribeEvent("heartbeat");
      } catch {
      }
    }
  

    await this.servient.shutdown();
    console.log(`[DeviceMonitor ${this.wotEndpoint}] Stopped`);
  }

  public markInactive(): void {
    console.log(`[DeviceMonitor ${this.wotEndpoint}] Marked as inactive`);
    this.isActive = false;

    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  public getDeviceId(): string {
    return this.deviceId;
  }

  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }

    const timeoutThreshold = this.dynamicIntervalMs * this.HEARTBEAT_MULTIPLIER;

    this.heartbeatTimeout = setTimeout(async () => {
      if(!this.isRunning || !this.isActive) return;

      const missingEventId = this.lastSeenEventId + 1;
      this.lastSeenEventId = missingEventId;

      console.warn(`[DeviceMonitor] Heartbeat timeout. Penalizing EventID: ${missingEventId}`);

      await this.contractService.submitAvailabilityReport(this.deviceId, false, missingEventId);

      this.resetHeartbeatTimeout();
    }, timeoutThreshold); 
  }

  private async evaluateAccuracy(eventId: number): Promise<void> {
    try {
      let accurate = true;
      const td = await this.thing.getThingDescription();

      if (!td.properties) {
         console.warn(`[DeviceMonitor ${this.wotEndpoint}] No properties found in TD to evaluate.`);
         return;
      }

      for (const propName of Object.keys(td.properties)) {
        const propSchema = td.properties[propName];

        if (propSchema.type === 'number' || propSchema.type === 'integer') {
          let value: number;

          try {
            const rawValue = await this.thing.readProperty(propName);
            value = await rawValue.value(); 
          } catch (validationError: any) {
            console.log(`[DeviceMonitor ${this.wotEndpoint}] W3C Schema Violation on '${propName}': Device output rejected by W3C validator.`);
            accurate = false;
            continue;
          }

          const min = propSchema.minimum;
          const max = propSchema.maximum;

          if (min !== undefined && value < min) {
             console.log(`[DeviceMonitor ${this.wotEndpoint}] Inaccurate reading: '${propName}' value ${value} is below minimum ${min}`);
             accurate = false;
          }
          
          if (max !== undefined && value > max) {
             console.log(`[DeviceMonitor ${this.wotEndpoint}] Inaccurate reading: '${propName}' value ${value} is above maximum ${max}`);
             accurate = false;
          }
        }
      }

      if (accurate) {
        console.log(`[DeviceMonitor ${this.wotEndpoint}] All property readings are within acceptable bounds.`);
      } else {
        console.log(`[DeviceMonitor ${this.wotEndpoint}] Device penalized for anomalous readings.`);
      }

      await this.contractService.submitAccuracyReport(this.deviceId, accurate, eventId);
      
    } catch (error) {
      console.error(`[DeviceMonitor ${this.wotEndpoint}] Failed to evaluate accuracy dynamically: `, error);
    }
  }
}