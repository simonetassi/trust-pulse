import { ContractService } from "./ContractService";
import { DeviceMonitor } from "./DeviceMonitor";

export class OracleManager {
  private contractService: ContractService;
  private monitors: Map<string, DeviceMonitor> = new Map();

  public constructor() {
    this.contractService = new ContractService();
  }

  public async startAll(): Promise<void> {
    console.log(`[OracleManager] Syncing devices from the blockchain...`);

    const contract = this.contractService.getContractInstance();
    const allDeviceIds = await contract.getAllDevices();

    for (const deviceId of allDeviceIds) {
      const deviceData = await contract.devices(deviceId);
      
      if (deviceData.active) {
        const wotEndpoint = deviceData.wotEndpoint;
        
        const monitor = new DeviceMonitor(wotEndpoint, this.contractService);
        await monitor.start();
        
        this.monitors.set(deviceId, monitor);
      }
    }

    this.listenForNewDevices();
    this.listenForDeactivations();
    console.log(`[OracleManager] Sync complete. All active monitors running.`);
  }

  public async stopAll(): Promise<void> {
    console.log(`Stopping all monitors`);
    await Promise.all(Array.from(this.monitors.values()).map(monitor => monitor.stop()));
    this.monitors.clear();
  }

  private listenForNewDevices(): void {
    const contract = this.contractService.getContractInstance();
    
    contract.on("DeviceEnrolled", async (deviceId: string, operator: string, wotEndpoint: string) => {
      if (this.monitors.has(deviceId)) return; 

      console.log(`[OracleManager] New device detected on-chain! Starting monitor for ${wotEndpoint}`);
      
      const monitor = new DeviceMonitor(wotEndpoint, this.contractService);
      await monitor.start();
      this.monitors.set(deviceId, monitor);
    });
  }

  private listenForDeactivations(): void {
    const contract = this.contractService.getContractInstance();
    
    contract.on("DeviceDeactivated", async (deviceId: string) => {
      const monitor = this.monitors.get(deviceId);
      if (monitor) {
        await monitor.stop();
        this.monitors.delete(deviceId);
        console.log(`[OracleManager] Cleaned up monitor for deactivated device: ${deviceId}`);
      }
    });
  }
}