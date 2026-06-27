const { WebSocketServer } = require('ws');
const { URL } = require('url');

function createViewSocketHub(server, options: any = {}) {
  const hubPath = options.path || '/ws';
  const isOriginAllowed = typeof options.isOriginAllowed === 'function'
    ? options.isOriginAllowed
    : () => true;

  const wss = new WebSocketServer({ noServer: true });
  const slugSubscriptions = new Map();

  function resolveRequestBase(request) {
    const forwardedProto = String(request.headers['x-forwarded-proto'] || '')
      .split(',')[0]
      .trim();
    const protocol = forwardedProto || (request.socket && request.socket.encrypted ? 'https' : 'http');
    const forwardedHost = String(request.headers['x-forwarded-host'] || '')
      .split(',')[0]
      .trim();
    const host = forwardedHost || String(request.headers.host || 'localhost').trim();
    return `${protocol}://${host}`;
  }

  function tryParse(raw) {
    try {
      return JSON.parse(String(raw || ''));
    } catch (_) {
      return null;
    }
  }

  function addSubscription(ws, slug) {
    const normalized = String(slug || '').trim().toLowerCase();
    if (!normalized) return;
    removeSubscription(ws);
    let set = slugSubscriptions.get(normalized);
    if (!set) {
      set = new Set();
      slugSubscriptions.set(normalized, set);
    }
    set.add(ws);
    ws._slugSubscription = normalized;
  }

  function removeSubscription(ws) {
    const slug = ws && ws._slugSubscription;
    if (!slug) return;
    const set = slugSubscriptions.get(slug);
    if (set) {
      set.delete(ws);
      if (set.size === 0) slugSubscriptions.delete(slug);
    }
    ws._slugSubscription = '';
  }

  function send(ws, payload) {
    if (!ws || ws.readyState !== 1) return;
    ws.send(JSON.stringify(payload));
  }

  function broadcastViewUpdate(slug, views, extra = {}) {
    const normalized = String(slug || '').trim().toLowerCase();
    if (!normalized) return;
    const clients = slugSubscriptions.get(normalized);
    if (!clients || clients.size === 0) return;
    const payload = {
      type: 'view:update',
      slug: normalized,
      views: Number(views || 0),
      ...extra,
      ts: new Date().toISOString()
    };
    clients.forEach((client) => send(client, payload));
  }

  server.on('upgrade', (request, socket, head) => {
    let parsed;
    try {
      parsed = new URL(request.url || '/', resolveRequestBase(request));
    } catch (_) {
      socket.destroy();
      return;
    }

    if (parsed.pathname !== hubPath) {
      return;
    }

    const origin = request.headers.origin || '';
    if (origin && !isOriginAllowed(origin)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    wss.handleUpgrade(request, socket, head, (ws) => {
      ws._slugSubscription = '';
      const initialSlug = parsed.searchParams.get('slug') || '';
      if (initialSlug) addSubscription(ws, initialSlug);

      send(ws, {
        type: 'connected',
        slug: ws._slugSubscription || null,
        ts: new Date().toISOString()
      });

      ws.on('message', (raw) => {
        const msg = tryParse(raw);
        if (!msg || typeof msg !== 'object') return;
        if (msg.type === 'subscribe' && msg.slug) {
          addSubscription(ws, msg.slug);
          send(ws, { type: 'subscribed', slug: ws._slugSubscription, ts: new Date().toISOString() });
          return;
        }
        if (msg.type === 'unsubscribe') {
          removeSubscription(ws);
          send(ws, { type: 'unsubscribed', ts: new Date().toISOString() });
          return;
        }
        if (msg.type === 'ping') {
          send(ws, { type: 'pong', ts: new Date().toISOString() });
        }
      });

      ws.on('close', () => removeSubscription(ws));
      ws.on('error', () => removeSubscription(ws));
    });
  });

  return {
    broadcastViewUpdate,
    getStats() {
      let clients = 0;
      slugSubscriptions.forEach((set) => {
        clients += set.size;
      });
      return { channels: slugSubscriptions.size, clients };
    }
  };
}

module.exports = { createViewSocketHub };

export {};
