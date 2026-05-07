/**
 * Singleton WebSocket client for the order board.
 *
 * One connection per browser tab, shared by every component that calls
 * `useOrderBoardSocket`. Handles auto-reconnect with exponential backoff
 * and JWT-rotation aware re-auth (drops + reopens when the token changes).
 */
import type { OrderListItem, OrderStatus, Role } from '@versuitality/types';

import { useAuthStore } from '@/store/authStore';

export type ConnectionStatus = 'idle' | 'connecting' | 'open' | 'reconnecting' | 'closed';

export type OrderBoardEvent =
  | { kind: 'hello'; role: Role; server_time: string }
  | {
      kind: 'order_created';
      order: OrderListItem;
      actor: { id: string; full_name: string; role: Role } | null;
      at: string;
    }
  | {
      kind: 'order_status_changed';
      order: OrderListItem;
      previous_status: OrderStatus;
      actor: { id: string; full_name: string; role: Role } | null;
      reason: string;
      at: string;
    }
  | {
      kind: 'order_updated';
      order: OrderListItem;
      actor: { id: string; full_name: string; role: Role } | null;
      at: string;
    };

type EventHandler = (event: OrderBoardEvent) => void;
type StatusHandler = (status: ConnectionStatus) => void;

const HTTP_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8000';
const WS_BASE = HTTP_BASE.replace(/^http/i, (m) => (m.toLowerCase() === 'https' ? 'wss' : 'ws'));

const MAX_BACKOFF_MS = 15_000;

class OrderBoardSocket {
  private ws: WebSocket | null = null;
  private eventHandlers = new Set<EventHandler>();
  private statusHandlers = new Set<StatusHandler>();
  private status: ConnectionStatus = 'idle';
  private currentToken: string | null = null;
  private reconnectAttempt = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private intentionallyClosed = false;

  setToken(token: string | null): void {
    if (token === this.currentToken) return;
    this.currentToken = token;
    this.intentionallyClosed = !token;
    this.teardown();
    if (token) this.openSoon();
    else this.setStatus('idle');
  }

  on(h: EventHandler): () => void {
    this.eventHandlers.add(h);
    return () => this.eventHandlers.delete(h);
  }

  onStatus(h: StatusHandler): () => void {
    this.statusHandlers.add(h);
    h(this.status);
    return () => this.statusHandlers.delete(h);
  }

  getStatus(): ConnectionStatus {
    return this.status;
  }

  private openSoon(delay = 0): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => this.open(), delay);
  }

  private open(): void {
    if (typeof window === 'undefined') return;
    if (!this.currentToken) return;
    this.intentionallyClosed = false;
    this.setStatus(this.reconnectAttempt > 0 ? 'reconnecting' : 'connecting');

    const url = `${WS_BASE}/ws/orders/?token=${encodeURIComponent(this.currentToken)}`;
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;

    ws.addEventListener('open', () => {
      this.reconnectAttempt = 0;
      this.setStatus('open');
    });

    ws.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data) as OrderBoardEvent;
        this.eventHandlers.forEach((h) => {
          try {
            h(data);
          } catch {
            /* keep other handlers running */
          }
        });
      } catch {
        /* ignore malformed payloads */
      }
    });

    ws.addEventListener('error', () => {
      // 'close' will fire next; keep state-management there.
    });

    ws.addEventListener('close', (event) => {
      this.ws = null;
      this.setStatus('closed');
      if (this.intentionallyClosed) return;
      // 4401 = unauthenticated; don't loop forever — let the client re-auth.
      if (event.code === 4401) return;
      this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    this.reconnectAttempt += 1;
    const backoff = Math.min(
      MAX_BACKOFF_MS,
      400 * 2 ** Math.min(6, this.reconnectAttempt - 1),
    );
    this.openSoon(backoff);
  }

  private teardown(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      const ws = this.ws;
      this.ws = null;
      try {
        ws.close();
      } catch {
        /* ignore */
      }
    }
    this.reconnectAttempt = 0;
  }

  private setStatus(next: ConnectionStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.statusHandlers.forEach((h) => h(next));
  }
}

export const orderSocket = new OrderBoardSocket();

// Keep the singleton's token in sync with the auth store. Subscribing here
// (rather than inside a hook) means the socket is wired up the moment the
// store rehydrates, before any component mounts.
if (typeof window !== 'undefined') {
  // Initialize from the rehydrated state.
  orderSocket.setToken(useAuthStore.getState().access);
  useAuthStore.subscribe((state, prev) => {
    if (state.access !== prev.access) {
      orderSocket.setToken(state.access);
    }
  });
}
