export interface DeviceConfig {
  id: string;
  port: number;
  deviceType: string;
  faultRate: number;
  heartbeatInterval: number;
  temperature: {
    min: number;
    max: number;
  };
  humidity: {
    min: number;
    max: number;
  };
}

export const deviceConfigs: DeviceConfig[] = [
  {
    id: "sensor-01",
    port: 8081,
    deviceType: "temperature-humidity-sensor",
    faultRate: 0.05,
    heartbeatInterval: 30000,
    temperature: { min: 18, max: 26 },
    humidity: { min: 40, max: 70 }
  },
  {
    id: "sensor-02",
    port: 8082,
    deviceType: "temperature-humidity-sensor",
    faultRate: 0.25,
    heartbeatInterval: 30000,
    temperature: { min: 18, max: 26 },
    humidity: { min: 40, max: 70 }
  },
  {
    id: "sensor-03",
    port: 8083,
    deviceType: "temperature-humidity-sensor",
    faultRate: 0.6,
    heartbeatInterval: 30000,
    temperature: { min: 18, max: 26 },
    humidity: { min: 40, max: 70 }
  }
];

export const PLAUSIBILITY_BOUNDS = {
  temperature: { min: -10, max: 60 },
  humidity: { min: 0, max: 100 }
};