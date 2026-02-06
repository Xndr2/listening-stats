import { ListeningStats, ProviderType } from "../../types/listeningstats";

export interface TrackingProvider {
  type: ProviderType;
  periods: string[];
  periodLabels: Record<string, string>;
  defaultPeriod: string;

  init(): void;
  destroy(): void;
  calculateStats(period: string): Promise<ListeningStats>;
  prefetchPeriod?(period: string): void;
  clearData?(): void;
}
