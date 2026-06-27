// @ts-nocheck
/* global window, WebSocket */
(function initWsClient(globalScope) {
  function noop() {}

  function toNumber(value, fallback) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function safeParseJson(raw) {
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function createWebSocketClient(options) {
    const opts = options || {};
    const reconnectCfg = opts.reconnect || {};
    const heartbeatCfg = opts.heartbeat || {};

    const reconnectEnabled = reconnectCfg.enabled !== false;
    const initialDelayMs = Math.max(100, toNumber(reconnectCfg.initialDelayMs, 1000));
    const maxDelayMs = Math.max(initialDelayMs, toNumber(reconnectCfg.maxDelayMs, 15000));
    const multiplier = Math.max(1.1, toNumber(reconnectCfg.multiplier, 1.8));
    const jitterRatio = Math.min(0.9, Math.max(0, toNumber(reconnectCfg.jitterRatio, 0.2)));
    const maxAttempts = reconnectCfg.maxAttempts == null ? Infinity : Math.max(1, toNumber(reconnectCfg.maxAttempts, Infinity));

    const heartbeatEnabled = heartbeatCfg.enabled === true;
    const heartbeatIntervalMs = Math.max(1000, toNumber(heartbeatCfg.intervalMs, 30000));
    const heartbeatPayload = heartbeatCfg.payload || function payloadFactory() { return { type: 'ping' }; };

    const parseJson = opts.parseJson !== false;
    const debug = opts.debug === true;

    const onOpen = typeof opts.onOpen === 'function' ? opts.onOpen : noop;
    const onClose = typeof opts.onClose === 'function' ? opts.onClose : noop;
    const onError = typeof opts.onError === 'function' ? opts.onError : noop;
    const onMessage = typeof opts.onMessage === 'function' ? opts.onMessage : noop;
    const onReconnect = typeof opts.onReconnect === 'function' ? opts.onReconnect : noop;
    const onStateChange = typeof opts.onStateChange === 'function' ? opts.onStateChange : noop;

    let ws = null;
    let reconnectTimer = null;
    let heartbeatTimer = null;
    let reconnectAttempts = 0;
    let manualClose = false;
    let currentState = 'idle';

    function log() {
      if (!debug) return;
      const args = Array.prototype.slice.call(arguments);
      args.unshift('[ws-client]');
      console.log.apply(console, args);
    }

    function setState(nextState) {
      if (currentState === nextState) return;
      currentState = nextState;
      onStateChange(nextState);
    }

    function clearTimers() {
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (heartbeatTimer) {
        clearInterval(heartbeatTimer);
        heartbeatTimer = null;
      }
    }

    function resolveUrl() {
      if (typeof opts.url === 'function') return String(opts.url());
      return String(opts.url || '');
    }

    function send(payload) {
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      try {
        const data = (typeof payload === 'string') ? payload : JSON.stringify(payload);
        ws.send(data);
        return true;
      } catch (error) {
        log('send failed', error);
        return false;
      }
    }

    function scheduleReconnect() {
      if (manualClose || !reconnectEnabled) return;
      if (reconnectAttempts >= maxAttempts) {
        setState('closed');
        return;
      }
      reconnectAttempts += 1;
      const base = Math.min(maxDelayMs, initialDelayMs * (multiplier ** (reconnectAttempts - 1)));
      const jitter = base * jitterRatio * Math.random();
      const delayMs = Math.round(base + jitter);
      onReconnect({ attempt: reconnectAttempts, delayMs });
      reconnectTimer = setTimeout(connect, delayMs);
    }

    function startHeartbeat() {
      if (!heartbeatEnabled) return;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = setInterval(function heartbeatTick() {
        if (!ws || ws.readyState !== WebSocket.OPEN) return;
        const payload = (typeof heartbeatPayload === 'function') ? heartbeatPayload() : heartbeatPayload;
        send(payload);
      }, heartbeatIntervalMs);
    }

    function connect() {
      const url = resolveUrl();
      if (!url) {
        log('missing url');
        return;
      }

      clearTimers();
      manualClose = false;

      try {
        setState('connecting');
        ws = new WebSocket(url, opts.protocols);
      } catch (error) {
        log('connect failed', error);
        onError(error);
        scheduleReconnect();
        return;
      }

      ws.onopen = function handleOpen(event) {
        reconnectAttempts = 0;
        setState('open');
        startHeartbeat();
        onOpen(event);
      };

      ws.onmessage = function handleMessage(event) {
        const parsed = parseJson ? safeParseJson(String(event.data || '')) : event.data;
        onMessage(parsed, event);
      };

      ws.onerror = function handleError(event) {
        onError(event);
      };

      ws.onclose = function handleClose(event) {
        clearTimers();
        setState('closed');
        onClose(event);
        scheduleReconnect();
      };
    }

    function close(code, reason) {
      manualClose = true;
      clearTimers();
      if (!ws) {
        setState('closed');
        return;
      }
      try {
        ws.close(code || 1000, reason || 'client-close');
      } catch (_) {}
      ws = null;
      setState('closed');
    }

    function isOpen() {
      return Boolean(ws && ws.readyState === WebSocket.OPEN);
    }

    if (opts.autoConnect !== false) {
      connect();
    }

    return {
      connect,
      close,
      send,
      isOpen,
      getState: function getState() { return currentState; }
    };
  }

  globalScope.createWsClient = createWebSocketClient;
}(window));

