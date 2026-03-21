export interface Device {
  deviceId: string;
  wotEndpoint: string;
  deviceType: string;
  operator: string;
  accuracyScore: number;
  availabilityScore: number;
  compositeScore: number;
  totalReports: number;
  registeredAt: number;
  active: boolean;
}