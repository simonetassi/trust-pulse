import { DeviceConfig } from "./deviceConfig";
import { Servient } from "@node-wot/core";
import { HttpServer } from "@node-wot/binding-http";

export class DeviceSimulator {
  private config: DeviceConfig;
  private servient: Servient;
  private thing: any = null; // inconsistent node-wot ExposedThing type?
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isRunning: boolean = false;

  private currentTemperature = 20;
  private currentHumidity = 50;

  public constructor(config: DeviceConfig){
    this.config = config;

    this.servient = new Servient();
    this.servient.addServer(new HttpServer({ port: config.port }));
  }

  public async start(): Promise<void> {
    const WoT = await this.servient.start();

    const td: any = {
      title: `${this.config.id}`,
      id: `urn:trustpulse:${this.config.id}`,
      description: `Simulated ${this.config.deviceType} for TrustPulse network`,
      properties: {
        temperature: {
          type: "number",
          description: "Current temperature reading in Celsius",
          unit: "celsius",
          readOnly: true,
          observable: false
        },
        humidity: {
          type: "number",
          description: "Current relative humidity reading",
          unit: "percent",
          readOnly: true,
          observable: false
        },
        status: {
          type: "string",
          description: "Device operational status",
          readOnly: true,
          observable: false,
          enum: ["online", "faulty"]
        }
      },
      events: {
        heartbeat: {
          description: "Periodic liveness signal emitted by the device",
          data: {
            type: "object",
            properties: {
              timestamp: { type: "number" },
              deviceId: { type: "string" }
            }
          }
        }
      }
    };

    this.thing = await WoT.produce(td);

    this.thing?.setPropertyReadHandler("temperature", async () => {
      return this.generateReading(
        this.config.temperature.min,
        this.config.temperature.max,
        -50,
        999
      );
    });

    this.thing?.setPropertyReadHandler("humidity", async () => {
      return this.generateReading(
        this.config.humidity.min,
        this.config.humidity.max,
        -50,
        999
      );
    });

    this.thing?.setPropertyReadHandler("status", async () => {
      return this.isRunning ? "online" : "offline";
    });

    await this.thing?.expose();
    this.isRunning = true;

    this.startHeartbeat();

    console.log(
      `[${this.config.id}] Started on port ${this.config.port} ` +
      `(faultRate: ${this.config.faultRate})`
    );
  }

  public async stop(): Promise<void> {
    this.isRunning = false;

    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }

    await this.servient.shutdown();
    console.log(`[${this.config.id}] Stopped`);
  } 

  public setFaultRate(rate: number): void {
    if (rate < 0 || rate > 1) throw new Error("Fault rate must be between 0 and 1");
    this.config.faultRate = rate;
    console.log(`[${this.config.id}] Fault rate updated to ${rate}`);
  }

  public getConfig(): DeviceConfig {
    return { ...this.config };
  }

  public getEndpoint(): string {
    return `http://localhost:${this.config.port}`;
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.thing && this.isRunning) {
        this.thing.emitEvent("heartbeat", {
          timestamp: Date.now(),
          deviceId: this.config.id
        });
      }
    }, this.config.heartbeatInterval);
  }

  private generateReading(normalMin: number, normalMax: number, faultMin: number, faultMax: number): number {
    const isFaulty = Math.random() < this.config.faultRate;

    if (isFaulty) {
      return this.randomInRange(faultMin, faultMax);
    }

    return parseFloat(this.randomInRange(normalMin, normalMax).toFixed(2));
  }

  private randomInRange(min: number, max: number): number {
    return Math.random() * (max - min) + min;
  }
}