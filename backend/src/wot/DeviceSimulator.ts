import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";
import { SimulatorProfile } from "./deviceConfig";

export class DeviceSimulator {
  private profile: SimulatorProfile;
  private servient: Servient;
  private thing: any = null; 
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  private sequenceNonce = 0;
  private faultRate: number;

  public constructor(profile: SimulatorProfile) {
    this.profile = profile;
    this.servient = new Servient();
    this.servient.addServer(new HttpServer({ port: profile.port }));

    const isFaultyDevice = Math.random() > 0.5;
    if (isFaultyDevice) {
      this.faultRate = parseFloat((Math.random() * 0.35 + 0.05).toFixed(2));
    } else {
      this.faultRate = 0.0;
    }
  }

  public async start(): Promise<void> {
    const WoT = await this.servient.start();

    const dynamicProperties: any = {
      heartbeatInterval: {
        type: "number",
        description: "The interval in milliseconds at which this device emits heartbeats",
        readOnly: true,
        observable: false
      },
      status: {
        type: "string",
        description: "Device operational status",
        readOnly: true,
        observable: false,
        enum: ["online", "faulty", "offline"]
      }
    };

    for (const [key, propConfig] of Object.entries(this.profile.properties)) {
      dynamicProperties[key] = {
        type: propConfig.type,
        readOnly: true,
        observable: false
      };
      
      if (propConfig.minimum !== undefined) dynamicProperties[key].minimum = propConfig.minimum;
      if (propConfig.maximum !== undefined) dynamicProperties[key].maximum = propConfig.maximum;
    }

    const td: any = {
      title: this.profile.id,
      id: `urn:trustpulse:${this.profile.id}`,
      description: `Simulated WoT device for TrustPulse network`,
      properties: dynamicProperties,
      events: {
        heartbeat: {
          description: "Periodic liveness signal emitted by the device",
          data: {
            type: "object",
            properties: {
              timestamp: { type: "number" },
              deviceId: { type: "string" },
              eventId: { type: "number" }
            }
          }
        }
      }
    };

    this.thing = await WoT.produce(td);

    this.thing?.setPropertyReadHandler("status", async () => {
      return this.isRunning ? "online" : "offline";
    });

    this.thing?.setPropertyReadHandler("heartbeatInterval", async () => {
      return this.profile.heartbeatInterval;
    });

    for (const [key, propConfig] of Object.entries(this.profile.properties)) {
      this.thing?.setPropertyReadHandler(key, async () => {
        return this.generateReading(propConfig);
      });
    }

    await this.thing?.expose();
    this.isRunning = true;

    this.startHeartbeat();

    console.log(
      `[${this.profile.id}] Simulator '${this.profile.title}' started on port ${this.profile.port} ` +
      `(faultRate: ${this.faultRate})`
    );
  }

  public async stop(): Promise<void> {
    this.isRunning = false;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    await this.servient.shutdown();
    console.log(`[${this.profile.id}] Stopped`);
  } 

  public setFaultRate(rate: number): void {
    if (rate < 0 || rate > 1) throw new Error("Fault rate must be between 0 and 1");
    this.faultRate = rate;
    console.log(`[${this.profile.id}] Fault rate updated to ${rate}`);
  }

  public getProfile(): SimulatorProfile {
    return { ...this.profile };
  }

  public getEndpoint(): string {
    return `http://localhost:${this.profile.port}`;
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.thing && this.isRunning) {
        this.sequenceNonce++;

        this.thing.emitEvent("heartbeat", {
          timestamp: Date.now(),
          deviceId: this.profile.id,
          eventId: this.sequenceNonce
        });
      }
    }, this.profile.heartbeatInterval);
  }

  private generateReading(propConfig: any): any {
    if (propConfig.type === 'boolean') {
      return Math.random() > 0.5;
    }

    if (propConfig.type === 'number') {
      const min = propConfig.minimum ?? 0;
      const max = propConfig.maximum ?? 100;
      const isFaulty = Math.random() < this.faultRate;

      if (isFaulty) {
        const anomalyOffset = (max - min) * 1.5;
        const outOfBoundsValue = Math.random() > 0.5 ? max + anomalyOffset : min - anomalyOffset;
        return parseFloat(outOfBoundsValue.toFixed(2));
      }

      const safeValue = Math.random() * (max - min) + min;
      return parseFloat(safeValue.toFixed(2));
    }

    return "unknown";
  }
}