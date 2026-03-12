import { deviceConfigs } from "./deviceConfig";
import { DeviceSimulator } from "./DeviceSimulator";

export class DeviceManager {
  private devices: Map<string, DeviceSimulator> = new Map();

  public async startAll(): Promise<void> {
    console.log(`\nStarting WoT device network (${deviceConfigs.length} devices)...`);

    await Promise.all(
      deviceConfigs.map(async (config) => {
        const device = new DeviceSimulator(config);
        device.start();
        this.devices.set(config.id, device);
      }));

    console.log(`\nWoT network online. Devices:`);
    this.devices.forEach((device, id) => {
      console.log(`  ${id} → ${device.getEndpoint()}`);
    });
  }

  public async stopAll(): Promise<void> {
    await Promise.all(
      Array.from(this.devices.values()).map(device => device.stop())
    );
    this.devices.clear();
    console.log("WoT network stopped.");
  }

  public getDevice(id: string): DeviceSimulator | undefined {
    return this.devices.get(id);
  }

  public getAllDevices(): Map<string, DeviceSimulator> {
    return this.devices;
  }

  public setNetworkFaultRate(rate: number): void {
    this.devices.forEach(device => device.setFaultRate(rate));
    console.log(`All devices fault rate set to ${rate}`);
  }
}