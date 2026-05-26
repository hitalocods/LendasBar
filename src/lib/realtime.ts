export const REALTIME_INTERVAL_MS = 2500;

export type RealtimeChannel =
  | `table:${string}`
  | `kitchen:${string}`
  | `admin:${string}`;

export function createRealtimeChannel(type: "table" | "kitchen" | "admin", id: string): RealtimeChannel {
  return `${type}:${id}` as RealtimeChannel;
}

export function getPollingDelay(channel: RealtimeChannel) {
  if (channel.startsWith("kitchen:")) return 1500;
  if (channel.startsWith("table:")) return REALTIME_INTERVAL_MS;
  return 5000;
}
