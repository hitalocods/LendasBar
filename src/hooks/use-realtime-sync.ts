"use client";

import { useEffect } from "react";
import { RealtimeChannel, getPollingDelay } from "@/lib/realtime";

type SyncOptions = {
  channel: RealtimeChannel;
  enabled?: boolean;
  onTick: () => void;
};

export function useRealtimeSync({ channel, enabled = true, onTick }: SyncOptions) {
  useEffect(() => {
    if (!enabled) return;

    const interval = window.setInterval(onTick, getPollingDelay(channel));
    return () => window.clearInterval(interval);
  }, [channel, enabled, onTick]);
}
