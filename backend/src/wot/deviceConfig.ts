export interface PropertyProfile {
  type: 'number' | 'boolean' | 'string';
  minimum?: number;
  maximum?: number;
}

export interface SimulatorProfile {
  id: string;
  port: number;
  title: string;
  heartbeatInterval: number;
  properties: Record<string, PropertyProfile>;
}

export const simulationProfiles: SimulatorProfile[] = [
  {
    id: "sensor-01",
    port: 8081,
    title: "Agricultural Weather Station",
    heartbeatInterval: 10000,
    properties: {
      temperature: { type: 'number', minimum: -10, maximum: 50 },
      humidity: { type: 'number', minimum: 0, maximum: 100 }
    }
  },
  {
    id: "sensor-02",
    port: 8082,
    title: "Industrial Pressure Valve",
    heartbeatInterval: 8000,
    properties: {
      pressurePSI: { type: 'number', minimum: 200, maximum: 800 }
    }
  },
  {
    id: "sensor-03",
    port: 8083,
    title: "Smart Door Lock",
    heartbeatInterval: 15000,
    properties: {
      isLocked: { type: 'boolean' }
    }
  }
];