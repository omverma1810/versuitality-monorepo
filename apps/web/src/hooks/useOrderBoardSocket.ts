'use client';

import { useEffect, useRef, useState } from 'react';

import {
  orderSocket,
  type ConnectionStatus,
  type OrderBoardEvent,
} from '@/lib/socket';

/**
 * Subscribes the calling component to live order-board events.
 *
 * The handler is held by ref so consumers can pass an inline closure without
 * re-subscribing on every render.
 */
export function useOrderBoardSocket(
  onEvent: (event: OrderBoardEvent) => void,
): ConnectionStatus {
  const handlerRef = useRef(onEvent);
  handlerRef.current = onEvent;

  const [status, setStatus] = useState<ConnectionStatus>(() =>
    orderSocket.getStatus(),
  );

  useEffect(() => {
    const offEvent = orderSocket.on((event) => handlerRef.current(event));
    const offStatus = orderSocket.onStatus(setStatus);
    return () => {
      offEvent();
      offStatus();
    };
  }, []);

  return status;
}

/** Lightweight hook for components that only care about the connection state. */
export function useOrderBoardStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>(() =>
    orderSocket.getStatus(),
  );
  useEffect(() => orderSocket.onStatus(setStatus), []);
  return status;
}
