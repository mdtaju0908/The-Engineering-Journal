const { WebSocketServer } = require('ws');
const { URL } = require('url');

function createAgentSocketHub(server, options: any = {}) {
  const hubPath = options.path || '/ws/agent';
  const isOriginAllowed = typeof options.isOriginAllowed === 'function'
    ? options.isOriginAllowed
    : () => true;

  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set();

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

  function send(ws, payload) {
    if (!ws || ws.readyState !== 1) return;
    try {
      ws.send(JSON.stringify(payload));
    } catch (_) {}
  }

  function broadcast(payload) {
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
      clients.add(ws);

      send(ws, {
        type: 'connected',
        ts: new Date().toISOString(),
        message: 'Agent WebSocket connected'
      });

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(String(raw || ''));
          if (msg.type === 'ping') {
            send(ws, { type: 'pong', ts: new Date().toISOString() });
          }
        } catch (_) {}
      });

      ws.on('close', () => clients.delete(ws));
      ws.on('error', () => clients.delete(ws));
    });
  });

  return {
    broadcast,
    getStats() {
      return { clients: clients.size };
    }
  };
}

module.exports = { createAgentSocketHub };

export {};
