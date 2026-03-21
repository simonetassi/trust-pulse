export interface AvailabilityReportEvent {
  deviceId: string;
  available: boolean;
  newAvailabilityScore: number;
  timestamp: number;
  txHash: string;
}
