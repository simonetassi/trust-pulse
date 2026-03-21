export interface ScoreHistoryEntry {
  type: 'accuracy' | 'availability';
  accurate?: boolean;
  online?: boolean;
  newScore: number;
  blockNumber: number;
  txHash: string;
}