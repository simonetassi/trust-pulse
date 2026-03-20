import { ScoreHistoryEntry } from "./score-history-entry.interface";

export interface DeviceHistory {
  deviceId: string;
  endpoint: string;
  history: ScoreHistoryEntry[];
}