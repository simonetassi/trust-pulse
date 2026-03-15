import Servient from "@node-wot/core";
import { ContractService } from "./ContractService";
import { HttpClientFactory } from "@node-wot/binding-http";
import { DeviceConfig, PLAUSIBILITY_BOUNDS } from "../wot/deviceConfig";

export class DeviceMonitor {
  private deviceId: string;
  private servient: Servient;
  private thing: any = null;
  private heartbeatTimeout: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  private readonly HEARTBEAT_MULTIPLIER = 1.5;

  public constructor(
    private wotEndpoint: string, 
    private contractService: ContractService,
    private deviceConfig: DeviceConfig) {
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

    console.log(`[DeviceMonitor ${this.wotEndpoint}] Connected. Starting Monitoring`);

    this.resetHeartbeatTimeout();

    await this.thing.subscribeEvent('heartbeat', async (data: any) => {
      if(!this.isRunning) return;

      console.log(`[DeviceMonitor] ${this.wotEndpoint} Heartbeat recevied`)

      this.resetHeartbeatTimeout();

      await this.contractService.submitAvailabilityReport(this.deviceId, true);

      await this.evaluateAccuracy();
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

  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }

    this.heartbeatTimeout = setTimeout(async () => {
      if(!this.isRunning) return;

      console.warn(`[DeviceMonitor ${this.wotEndpoint}] Heartbeat timeout -- device offline`);

      await this.contractService.submitAvailabilityReport(this.deviceId, false);

      this.resetHeartbeatTimeout();
    }, this.HEARTBEAT_MULTIPLIER * this.deviceConfig.heartbeatInterval); 
  }

  private async evaluateAccuracy(): Promise<void> {
    try {
      const temperatureRaw = await this.thing.readProperty('temperature');
      const humidityRaw = await this.thing.readProperty('humidity');

      const temperature = await temperatureRaw.value();
      const humidity = await humidityRaw.value();

      console.log(`[DeviceMonitor ${this.wotEndpoint}] temperature: ${temperature}, humidity: ${humidity}`);

      const temperatureVaild = temperature >= PLAUSIBILITY_BOUNDS.temperature.min &&
                                temperature <= PLAUSIBILITY_BOUNDS.temperature.max;

      const humidityVaild = humidity >= PLAUSIBILITY_BOUNDS.humidity.min &&
                            humidity <= PLAUSIBILITY_BOUNDS.humidity.max;

      const accurate = temperatureVaild && humidityVaild;

      if (!accurate) {
        console.log(`[DeviceMonitor ${this.wotEndpoint}] Inaccurate reading detected - ` +
          `temperature: ${temperature}, humidity: ${humidity}`
         )
      }

      this.contractService.submitAccuracyReport(this.deviceId, accurate);
    } catch (error) {
      console.error(`[DeviceMonitor ${this.wotEndpoint}] Failed to read device properties: `, error);
    }
  }
}