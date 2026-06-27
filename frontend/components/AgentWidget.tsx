'use client';

import { useState, useEffect } from 'react';
import { getAgentStatus, getAgentWebSocketUrl } from '@/lib/api';
import type { AgentLog, AgentStatusResponse } from '@/lib/types';

type AgentStatus = {
  step: string;
  topic?: string;
  image?: boolean;
  blog?: boolean;
  published?: boolean;
  nextRun?: string;
};

function normalizeAgentStatus(payload: AgentStatusResponse): AgentStatus {
  const latestLog = Array.isArray(payload.logs) ? payload.logs[0] : undefined;
  const status = payload.status || {};
  const step =
    status.step ||
    latestLog?.step ||
    (status.isRunning ? 'agent_started' : status.lastPublished ? 'agent_completed' : 'idle');

  return {
    step,
    topic: status.lastTopic || status.topic || latestLog?.topic || undefined,
    image: status.lastImageGenerated || undefined,
    blog: status.lastBlogWritten || undefined,
    published: status.lastPublished || undefined,
    nextRun: payload.nextRun || status.nextRunAt || status.nextRun || payload.settings?.nextRun || undefined,
  };
}

function normalizeAgentLogs(logs?: AgentLog[]) {
  if (!Array.isArray(logs)) return [];
  return logs
    .slice()
    .reverse()
    .map((log) => ({
      type: log.type || 'info',
      message: log.message || log.step || 'Agent update',
      timestamp: log.timestamp ? new Date(log.timestamp).getTime() : Date.now(),
    }))
    .slice(-50);
}

function isIdleStep(step?: string) {
  return !step || step === 'idle' || step === 'agent_completed' || step === 'blog_published';
}

export function AgentWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [logs, setLogs] = useState<{ type: string; message: string; timestamp: number }[]>([]);
  const [isIdle, setIsIdle] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  useEffect(() => {
    // Initial status fetch
    const fetchStatus = async () => {
      try {
        const data = await getAgentStatus();
        if (data && data.success !== false) {
          const normalized = normalizeAgentStatus(data);
          setStatus(normalized);
          setLogs(normalizeAgentLogs(data.logs));
          const isCurrentIdle = isIdleStep(normalized.step);
          setIsIdle(isCurrentIdle);
          setIsProcessing(!isCurrentIdle);
          const err = Array.isArray(data.logs) && data.logs.some(l => (l.type || '') === 'error');
          setHasError(err);
        }
      } catch (err) {
        console.error('Failed to fetch agent status', err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 10000);

    // Setup WebSocket
    let ws: WebSocket | null = null;
    let retryCount = 0;

    const connectWs = () => {
      try {
        const wsUrl =
          getAgentWebSocketUrl() ||
          `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/agent`;
        ws = new WebSocket(wsUrl);
        
        ws.onopen = () => {
          retryCount = 0;
        };

        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(event.data);
            if (payload.type === 'agent:status') {
              setStatus((prev) => ({
                ...(prev || { step: 'idle' }),
                ...payload,
                step: payload.step || prev?.step || 'idle',
              }));
              
              const currentIdle = isIdleStep(payload.step);
              setIsIdle(currentIdle);
              setIsProcessing(!currentIdle);
              
              const err = payload.type_log === 'error' || payload.step === 'error';
              setHasError(err);

              setLogs((prev) =>
                [
                  ...prev,
                  {
                    type: payload.type_log || 'info',
                    message: payload.message || payload.step || 'Agent update',
                    timestamp: payload.timestamp ? new Date(payload.timestamp).getTime() : Date.now(),
                  },
                ].slice(-50)
              );
            } else if (payload.type === 'agent:log') {
              setLogs((prev) => [
                ...prev,
                {
                  type: payload.type_log || 'info',
                  message: payload.message,
                  timestamp: Date.now(),
                },
              ].slice(-50));
            }
          } catch (e) {
            console.error('WS Parse Error', e);
          }
        };

        ws.onclose = () => {
          if (retryCount < 5) {
            retryCount++;
            setTimeout(connectWs, 2000 * retryCount);
          }
        };
      } catch (err) {
        console.error('WS Connection Error', err);
      }
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      clearInterval(interval);
    };
  }, []);

  const getProgress = (step?: string) => {
    switch (step) {
      case 'agent_started': return 5;
      case 'fetching_trends': return 20;
      case 'topic_selected': return 30;
      case 'generating_blog_content': return 50;
      case 'generating_cover_image': return 80;
      case 'uploading_image': return 90;
      case 'saving_blog_to_database': return 95;
      case 'blog_published': return 100;
      case 'agent_completed': return 100;
      default: return 0;
    }
  };

  const getStateClass = () => {
    if (hasError) return 'state-error';
    if (!isIdle) return 'state-working';
    return 'state-idle';
  };

  const formatStepLabel = () => {
    if (hasError) return 'ERROR';
    if (!isIdle) return 'RUNNING';
    return 'IDLE';
  };

  const minutesUntil = (dateStr?: string) => {
    if (!dateStr) return null;
    const m = Math.max(0, Math.round((new Date(dateStr).getTime() - Date.now()) / 60000));
    return m;
  };

  const formatTime = (ts: number) => {
    const t = new Date(ts);
    const hh = String(t.getHours()).padStart(2, '0');
    const mm = String(t.getMinutes()).padStart(2, '0');
    const ss = String(t.getSeconds()).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  };

  return (
    <>
      {/* Global Styles */}
      <style jsx global>{`
        :root {
          --ai-bg: #0a1628;
          --ai-accent: #00ff9d;
          --ai-pupil: #00ffcc;
        }
        @keyframes floater { 0% { transform: translateY(0); } 50% { transform: translateY(-4px); } 100% { transform: translateY(0); } }
        @keyframes orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.65; } }
        @keyframes breath { 0% { filter: brightness(1); } 50% { filter: brightness(1.2); } 100% { filter: brightness(1); } }
        @keyframes eyeBlink { 0% { transform: scaleY(1); } 80% { transform: scaleY(1); } 90% { transform: scaleY(0.05); } 100% { transform: scaleY(1); } }
        @keyframes typing { 0%, 60% { opacity: 0.2; } 60%, 80% { opacity: 0.6; } 80%, 100% { opacity: 1; } }
        @keyframes shine { to { left: 120%; } }
        @keyframes brainGlow { 
          0%, 100% { box-shadow: 0 0 10px color-mix(in oklab, var(--ai-accent) 20%, transparent), 0 0 20px color-mix(in oklab, var(--ai-accent) 7%, transparent); } 
          50% { box-shadow: 0 0 25px color-mix(in oklab, var(--ai-accent) 60%, transparent), 0 0 50px color-mix(in oklab, var(--ai-accent) 30%, transparent), 0 0 80px color-mix(in oklab, var(--ai-accent) 15%, transparent); } 
        }
        @keyframes aiRotateRing { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes aiCoreGlow { 0% { box-shadow: 0 0 8px #00ffd5; } 50% { box-shadow: 0 0 20px #00ffd5; } 100% { box-shadow: 0 0 8px #00ffd5; } }
      `}</style>

      {/* Launcher Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`ai-launcher ${isProcessing ? 'processing' : ''} ${hasError ? 'error' : ''}`}
        aria-label="AI Blog Agent"
        style={{ display: isOpen ? 'none' : 'flex' }}
      >
        <span className="ai-icon">
          <span className="ai-orbit"></span>
          <span className="ai-dot t"></span>
          <span className="ai-dot l"></span>
          <span className="ai-dot r"></span>
        </span>
        <span className="ai-label">AI Blog Agent</span>
      </button>

      {/* Widget Panel */}
      <div
        className={`ai-agent-widget ${isOpen ? 'visible' : 'hidden'}`}
        aria-hidden={!isOpen}
      >
        <div className="widget-header">
          <div className="widget-title">AI BLOG AGENT</div>
          <div className="flex items-center gap-2">
            <div className={`status-badge ${hasError ? 'status-error' : (!isIdle ? 'status-running' : 'status-idle')}`}>
              {formatStepLabel()}
            </div>
            <button
              className="min-btn"
              title="Minimize"
              onClick={() => setIsOpen(false)}
            >
              -
            </button>
          </div>
        </div>
        <div className="widget-body">
          <div className={`robot-wrap ${getStateClass()}`}>
            <div className="ai-avatar">
              <div className="ai-ring"></div>
              <div className="ai-core">
                <div className="eyes">
                  <div className="eye"></div>
                  <div className="eye"></div>
                </div>
              </div>
            </div>
            <div>
              <div className="thinking">
                AI Agent thinking
                <span className="dots">
                  <span className="d d1"></span>
                  <span className="d d2"></span>
                  <span className="d d3"></span>
                </span>
              </div>
            </div>
          </div>
          <div className="info-row">
            <span className="info-label">Last topic:</span>
            <span className="info-value topic-value">{status?.topic || '—'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Image:</span>
            <span className="info-value">{status?.image ? 'OK' : '—'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Blog:</span>
            <span className="info-value">{status?.blog ? 'OK' : '—'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Published:</span>
            <span className="info-value">{status?.published ? 'OK' : '—'}</span>
          </div>
          <div className="info-row">
            <span className="info-label">Next run:</span>
            <span className="info-value">
              {(() => { const m = minutesUntil(status?.nextRun); return m != null ? `${m} min` : '—'; })()}
            </span>
          </div>
          <div className="progress">
            <div 
              className="progress-bar" 
              style={{ width: `${getProgress(status?.step)}%` }}
            ></div>
          </div>
          <div className="logs-section">
            <div className="logs-title">LIVE LOGS</div>
            <div className="logs-container">
              {logs.map((log, i) => (
                <div key={i} className={`log-line log-${log.type}`}>
                  {formatTime(log.timestamp)} -&gt; {log.message}
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="widget-footer">Powered by Gemini • Updated every 10s</div>
      </div>

      {/* Inline Styles */}
      <style jsx>{`
        .ai-launcher {
          position: fixed;
          bottom: 20px;
          right: 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          height: 56px;
          padding: 0 16px;
          border-radius: 9999px;
          background: linear-gradient(135deg, rgba(6, 20, 26, 0.85), rgba(8, 14, 20, 0.8));
          backdrop-filter: blur(10px);
          border: 1px solid rgba(0, 255, 200, 0.35);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35), 0 0 24px rgba(0, 255, 200, 0.25);
          color: #d7fffb;
          cursor: pointer;
          transition: transform .2s ease, box-shadow .2s ease, background .3s ease;
          z-index: 9999;
          animation: floater 6s ease-in-out infinite;
        }
        .ai-launcher:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 10px 36px rgba(0, 0, 0, 0.45), 0 0 36px rgba(0, 255, 220, 0.4);
          background: linear-gradient(135deg, rgba(10, 30, 36, 0.9), rgba(12, 18, 26, 0.85));
        }
        .ai-launcher:active {
          transform: translateY(0) scale(0.98);
        }
        .ai-icon {
          position: relative;
          width: 30px;
          height: 30px;
          border-radius: 9999px;
          background: radial-gradient(70% 70% at 50% 30%, rgba(0, 255, 200, 0.35), transparent), linear-gradient(180deg, rgba(0, 30, 28, 0.95), rgba(0, 16, 18, 0.95));
          box-shadow: 0 0 16px rgba(0, 255, 200, 0.3), inset 0 0 12px rgba(0, 255, 200, 0.12);
          border: 1px solid rgba(0, 255, 200, 0.35);
        }
        .ai-orbit {
          position: absolute;
          inset: 4px;
          border: 1.5px dashed rgba(0, 255, 200, 0.35);
          border-radius: 9999px;
          transform-origin: 50% 50%;
          animation: orbit 8s linear infinite;
        }
        .ai-dot {
          position: absolute;
          width: 5px;
          height: 5px;
          border-radius: 9999px;
          background: #00ffd0;
          box-shadow: 0 0 8px rgba(0, 255, 200, 0.7);
        }
        .ai-dot.t {
          top: 0;
          left: 50%;
          transform: translate(-50%, -50%);
        }
        .ai-dot.l {
          left: 0;
          top: 50%;
          transform: translate(-50%, -50%);
        }
        .ai-dot.r {
          right: 0;
          top: 50%;
          transform: translate(50%, -50%);
        }
        .ai-label {
          font-weight: 700;
          letter-spacing: .25px;
          color: #d7fffb;
          text-shadow: 0 0 6px rgba(0, 255, 200, 0.35);
        }
        .ai-launcher.processing .ai-orbit {
          animation-duration: 4s;
        }
        .ai-launcher.processing .ai-icon {
          animation: breath 3s ease-in-out infinite;
        }
        .ai-launcher.error {
          border-color: rgba(255, 80, 80, 0.5);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.35), 0 0 24px rgba(255, 80, 80, 0.35);
        }
        .ai-launcher.error .ai-orbit {
          border-color: rgba(255, 80, 80, 0.5);
          animation-play-state: paused;
        }
        @media (max-width: 768px) {
          .ai-label {
            display: none;
          }
          .ai-launcher {
            padding: 0 10px;
            width: 56px;
            justify-content: center;
          }
        }
        .ai-agent-widget {
          position: fixed;
          bottom: 20px;
          right: 20px;
          width: 360px;
          max-height: 480px;
          background: rgba(10, 10, 15, 0.92);
          border: 1px solid rgba(0, 255, 180, 0.35);
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6), 0 0 20px rgba(0, 255, 180, 0.18);
          backdrop-filter: blur(8px);
          font-family: Consolas, 'Courier New', monospace;
          color: #e0fff5;
          z-index: 9999;
          transition: transform .2s ease, opacity .2s ease;
        }
        .ai-agent-widget.hidden {
          opacity: 0;
          transform: translateY(10px) scale(0.98);
          pointer-events: none;
        }
        .ai-agent-widget.visible {
          opacity: 1;
          transform: translateY(0) scale(1);
          pointer-events: auto;
        }
        .widget-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: rgba(0, 40, 30, 0.6);
          border-bottom: 1px solid rgba(0, 255, 180, 0.25);
        }
        .widget-title {
          font-size: 15px;
          font-weight: bold;
          letter-spacing: .5px;
          color: #00ffb4;
          text-shadow: 0 0 6px rgba(0, 255, 180, 0.5);
        }
        .status-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 700;
          letter-spacing: .3px;
        }
        .status-running {
          background: rgba(0, 255, 160, 0.2);
          color: #00ff9d;
          border: 1px solid rgba(0, 255, 157, 0.4);
          box-shadow: 0 0 16px rgba(0, 255, 160, 0.25);
          animation: pulse 2s infinite;
        }
        .status-idle {
          background: rgba(140, 140, 160, 0.18);
          color: #acb3c2;
          border: 1px solid rgba(122, 133, 148, 0.33);
        }
        .status-error {
          background: rgba(255, 80, 80, 0.18);
          color: #ff6b6b;
          border: 1px solid rgba(255, 107, 107, 0.4);
          box-shadow: 0 0 16px rgba(255, 80, 80, 0.25);
        }
        .min-btn {
          width: 28px;
          height: 28px;
          border-radius: 6px;
          background: rgba(30, 41, 59, 0.6);
          color: #e2e8f0;
          border: none;
          cursor: pointer;
        }
        .widget-body {
          padding: 16px;
          font-size: 13.5px;
          line-height: 1.5;
          background: linear-gradient(180deg, rgba(10, 22, 40, 0.95), rgba(8, 18, 32, 0.92));
          border-top: 1px solid rgba(0, 255, 200, 0.08);
        }
        .robot-wrap {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 12px;
        }
        .ai-avatar {
          position: relative;
          width: 72px;
          height: 72px;
          border-radius: 16px;
          background: radial-gradient(120px 120px at 50% -20%, color-mix(in oklab, var(--ai-accent) 30%, transparent), transparent), linear-gradient(180deg, rgba(10, 22, 40, 1), rgba(8, 18, 32, 1));
          box-shadow: 0 0 26px color-mix(in oklab, var(--ai-accent) 25%, transparent), inset 0 0 18px color-mix(in oklab, var(--ai-accent) 12%, transparent);
          border: 1px solid color-mix(in oklab, var(--ai-accent) 35%, transparent);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: box-shadow .3s;
        }
        .ai-core {
          position: relative;
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          animation: aiCoreGlow 3s ease-in-out infinite;
        }
        .ai-avatar .eyes {
          position: relative;
          width: 38px;
          height: 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          filter: drop-shadow(0 0 4px color-mix(in oklab, var(--ai-pupil) 60%, transparent));
        }
        .ai-avatar .eye {
          width: 10px;
          height: 10px;
          background: var(--ai-pupil);
          border-radius: 9999px;
          transform-origin: center center;
          box-shadow: 0 0 8px var(--ai-pupil);
        }
        .ai-ring {
          position: absolute;
          inset: -6px;
          border-radius: 9999px;
          border: 2px solid rgba(0, 255, 200, 0.6);
          box-shadow: 0 0 10px rgba(0, 255, 200, 0.6);
          transform-origin: center;
          animation: aiRotateRing 14s linear infinite;
        }
        .state-error .ai-ring {
          animation-play-state: paused;
        }
        .thinking {
          font-size: 11px;
          color: #a6fff0;
          letter-spacing: .5px;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .dots {
          display: inline-flex;
          gap: 4px;
          min-width: 34px;
        }
        .dots .d {
          width: 6px;
          height: 6px;
          border-radius: 9999px;
          background: #a6fff0;
          opacity: .2;
          animation: typing 2.5s infinite;
        }
        .dots .d2 {
          animation-delay: .25s;
        }
        .dots .d3 {
          animation-delay: .5s;
        }
        .progress {
          position: relative;
          height: 6px;
          border-radius: 9999px;
          background: rgba(0, 255, 180, 0.12);
          overflow: hidden;
          margin: 8px 0 12px;
        }
        .progress-bar {
          height: 100%;
          width: 0;
          background: linear-gradient(90deg, #00ffb4, #00e0ff);
          box-shadow: 0 0 14px rgba(0, 255, 200, 0.6), 0 0 30px rgba(0, 200, 255, 0.25);
          transition: width .5s ease;
          position: relative;
        }
        .progress-bar:after {
          content: '';
          position: absolute;
          top: 0;
          bottom: 0;
          width: 80px;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.6), transparent);
          filter: blur(6px);
          left: -80px;
          animation: shine 2.6s linear infinite;
        }
        .info-row {
          margin: 6px 0;
          display: flex;
          justify-content: space-between;
        }
        .info-label {
          color: rgba(136, 255, 221, 0.67);
          min-width: 90px;
        }
        .info-value {
          color: #e0fff5;
          text-align: right;
          word-break: break-word;
        }
        .topic-value {
          color: #ffd54f;
          font-weight: 500;
        }
        .logs-section {
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px dashed rgba(0, 255, 180, 0.2);
        }
        .logs-title {
          font-size: 12px;
          color: rgba(102, 255, 204, 0.53);
          margin-bottom: 8px;
          letter-spacing: .8px;
        }
        .log-line {
          margin: 4px 0;
          font-size: 13px;
          word-break: break-all;
          opacity: .92;
        }
        .log-info {
          color: #a5d6ff;
        }
        .log-success {
          color: #00ff9d;
        }
        .log-error {
          color: #ff6b6b;
        }
        .logs-container {
          max-height: 220px;
          overflow-y: auto;
          padding-right: 6px;
        }
        .logs-container::-webkit-scrollbar {
          width: 5px;
        }
        .logs-container::-webkit-scrollbar-track {
          background: rgba(20, 20, 30, 0.5);
        }
        .logs-container::-webkit-scrollbar-thumb {
          background: rgba(0, 255, 180, 0.4);
          border-radius: 10px;
        }
        .logs-container::-webkit-scrollbar-thumb:hover {
          background: rgba(0, 255, 180, 0.7);
        }
        .widget-footer {
          padding: 10px 16px;
          font-size: 11px;
          text-align: center;
          color: rgba(102, 255, 204, 0.4);
          border-top: 1px solid rgba(0, 255, 180, 0.15);
          background: rgba(0, 20, 15, 0.45);
        }
        .state-idle .ai-avatar {
          box-shadow: 0 0 22px rgba(0, 255, 200, 0.25), inset 0 0 16px rgba(0, 255, 200, 0.08);
          animation: breath 5s ease-in-out infinite;
        }
        .state-working .ai-avatar {
          box-shadow: 0 0 28px rgba(0, 255, 200, 0.45), inset 0 0 22px rgba(0, 255, 200, 0.12);
          animation: brainGlow 2.5s ease-in-out infinite;
        }
        .state-error .ai-avatar {
          box-shadow: 0 0 26px rgba(255, 80, 80, 0.5), inset 0 0 20px rgba(255, 80, 80, 0.15);
          border-color: rgba(255, 80, 80, 0.45);
        }
        .state-idle .ai-ring {
          animation-duration: 16s;
          animation-play-state: running;
        }
        .state-working .ai-ring {
          animation-duration: 12s;
          animation-play-state: running;
        }
        .state-error .ai-ring {
          animation-duration: 16s;
          animation-play-state: paused;
          border-color: rgba(255, 80, 80, 0.4);
        }
      `}</style>
    </>
  );
}
