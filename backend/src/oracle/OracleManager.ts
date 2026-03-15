import { deviceConfigs } from "../wot/deviceConfig";
import { ContractService } from "./ContractService";
import { DeviceMonitor } from "./DeviceMonitor";

export class OracleManager {
  private contractService: ContractService;
  private monitors: Map<string, DeviceMonitor> = new Map();

  public constructor() {
    this.contractService = new ContractService();
  }

  public async startAll(): Promise<void> {
    console.log(`Starting monitors for ${deviceConfigs.length} devices`);

    for (const config of deviceConfigs) {
      const endpoint = `http://localhost:${config.port}/${config.id}`

      const monitor = new DeviceMonitor(endpoint, this.contractService, config);
      await monitor.start()
      this.monitors.set(config.id, monitor);
    }
    console.log(`All monitors running`);
  }

  public async stopAll(): Promise<void> {
    console.log(`Stopping all monitors (${deviceConfigs.length} devices)`);
    Array.from(this.monitors.values()).forEach((monitor) => monitor.stop());

    this.monitors.clear();
  }
}
