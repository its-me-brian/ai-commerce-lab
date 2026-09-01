"use client";

import { useEffect, useCallback, useRef } from "react";
import { getBrowserClient } from "@/lib/database/supabase-browser";

type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE" | "*";

interface UseRealtimeOptions {
  table: string;
  event?: RealtimeEvent;
  filter?: string;
  enabled?: boolean;
}

/**
 * Subscribe to Supabase Realtime changes on a table.
 * Auto-cleans up on unmount.
 *
 * Usage:
 *   useRealtime({
 *     table: "conversation_messages",
 *     event: "INSERT",
 *     filter: `conversation_id=eq.${conversationId}`,
 *     onInsert: (payload) => setMessages(prev => [...prev, payload.new]),
 *   });
 */
export function useRealtime<T = Record<string, unknown>>(
  options: UseRealtimeOptions & {
    onInsert?: (row: T) => void;
    onUpdate?: (row: T) => void;
    onDelete?: (row: T) => void;
    onChange?: (event: RealtimeEvent, row: T) => void;
  }
) {
  const { table, event = "*", filter, enabled = true, onInsert, onUpdate, onDelete, onChange } = options;
  const callbacksRef = useRef({ onInsert, onUpdate, onDelete, onChange });
  callbacksRef.current = { onInsert, onUpdate, onDelete, onChange };

  const handleEvent = useCallback(
    (payload: { eventType: RealtimeEvent; new: T; old: Record<string, unknown> }) => {
      const { eventType, new: newRow } = payload;
      const cbs = callbacksRef.current;

      if (cbs.onChange) cbs.onChange(eventType, newRow);
      if (eventType === "INSERT" && cbs.onInsert) cbs.onInsert(newRow);
      if (eventType === "UPDATE" && cbs.onUpdate) cbs.onUpdate(newRow);
      if (eventType === "DELETE" && cbs.onDelete) cbs.onDelete(newRow);
    },
    []
  );

  useEffect(() => {
    if (!enabled) return;

    const client = getBrowserClient();
    if (!client) return;

    const channel = client
      .channel(`realtime:${table}`)
      .on(
        "postgres_changes",
        { event, schema: "public", table, filter },
        handleEvent as (payload: Record<string, unknown>) => void
      )
      .subscribe();

    return () => {
      client.removeChannel(channel);
    };
  }, [table, event, filter, enabled, handleEvent]);
}
