export interface ScoreHistoryEntry {
  type: 'accuracy' | 'availability';
  accurate?: boolean;
  available?: boolean;
  newScore: number;
  blockNumber: number;
  txHash: string;
}