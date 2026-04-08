import { useEffect, useRef, useCallback, useState } from 'react';

interface WebSocketMessage {
  type: string;
  [key: string]: any;
}

interface UseExecutionWebSocketProps {
  runId?: string;
  companyId?: string;
  onEvent?: (event: any) => void;
  onResult?: (result: any) => void;
  onConnected?: () => void;
  onDisconnected?: () => void;
  onError?: (error: Error) => void;
}

export function useExecutionWebSocket({
  runId,
  companyId,
  onEvent,
  onResult,
  onConnected,
  onDisconnected,
  onError,
}: UseExecutionWebSocketProps = {}) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    // Build WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    let url = `${protocol}//${host}/ws/executions`;

    // Add query params
    const params = new URLSearchParams();
    if (runId) params.append('runId', runId);
    if (companyId) params.append('companyId', companyId);
    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WebSocket] Connected to execution server');
      setIsConnected(true);
      onConnected?.();
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setLastMessage(data);

        switch (data.type) {
          case 'execution_event':
            onEvent?.(data);
            break;
          case 'execution_result':
            onResult?.(data);
            break;
          case 'connected':
            console.log('[WebSocket] Connection confirmed:', data.clientId);
            break;
          case 'pong':
            // Keep-alive response
            break;
        }
      } catch (err) {
        console.error('[WebSocket] Error parsing message:', err);
      }
    };

    ws.onclose = () => {
      console.log('[WebSocket] Disconnected');
      setIsConnected(false);
      onDisconnected?.();

      // Attempt reconnect after 3 seconds
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log('[WebSocket] Attempting to reconnect...');
        connect();
      }, 3000);
    };

    ws.onerror = (error) => {
      console.error('[WebSocket] Error:', error);
      onError?.(new Error('WebSocket connection error'));
    };
  }, [runId, companyId, onEvent, onResult, onConnected, onDisconnected, onError]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
      setIsConnected(false);
    }
  }, []);

  const subscribe = useCallback((newRunId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        runId: newRunId,
      }));
    }
  }, []);

  const unsubscribe = useCallback((unsubscribeRunId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'unsubscribe',
        runId: unsubscribeRunId,
      }));
    }
  }, []);

  const sendPing = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'ping',
        timestamp: Date.now(),
      }));
    }
  }, []);

  // Auto-connect on mount
  useEffect(() => {
    connect();

    // Set up ping interval (every 30 seconds)
    const pingInterval = setInterval(sendPing, 30000);

    return () => {
      disconnect();
      clearInterval(pingInterval);
    };
  }, [connect, disconnect, sendPing]);

  return {
    isConnected,
    lastMessage,
    subscribe,
    unsubscribe,
    sendPing,
    disconnect,
    reconnect: connect,
  };
}