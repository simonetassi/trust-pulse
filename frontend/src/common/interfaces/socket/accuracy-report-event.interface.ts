export interface AccuracyReportEvent {
  deviceId: string;
  accurate: boolean;
  newAccuracyScore: number;
  timestamp: number;
  txHash: string;
}