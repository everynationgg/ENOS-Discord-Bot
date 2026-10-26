'use client';

import { useState, useCallback, useEffect, useRef } from 'react';

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface FeatureCardProps<T = Record<string, unknown>> {
  id: string;
  icon: string;
  title: string;
  description: string;
  featureKey: string;
  initialEnabled?: boolean;
  initialConfig?: T;
  onSave?: (config: T, enabled: boolean) => Promise<void> | void;
  onToggle?: (enabled: boolean) => void;
  children?: (config: T, setConfig: (key: string, value: unknown) => void) => React.ReactNode;
}

export default function FeatureCard<T = Record<string, unknown>>({
  id,
  icon,
  title,
  description,
  featureKey,
  initialEnabled = false,
  initialConfig,
  onSave,
  onToggle,
  children,
}: FeatureCardProps<T>) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [config, setConfigState] = useState<T>((initialConfig ?? {}) as T);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const prevConfigStrRef = useRef<string>(JSON.stringify(initialConfig));

  useEffect(() => {
    setEnabled(initialEnabled);
  }, [initialEnabled]);

  useEffect(() => {
    if (initialConfig !== undefined) {
      const currentStr = JSON.stringify(initialConfig);
      if (currentStr !== prevConfigStrRef.current) {
        prevConfigStrRef.current = currentStr;
        setConfigState(initialConfig);
      }
    }
  }, [initialConfig]);

  const setConfig = useCallback((key: string, value: unknown) => {
    setConfigState((prev) => {
      const prevRecord = (prev ?? {}) as Record<string, unknown>;
      const nextVal = typeof value === 'function'
        ? (value as (oldVal: unknown) => unknown)(prevRecord[key])
        : value;
      return { ...prevRecord, [key]: nextVal } as T;
    });
    setSaveStatus('idle');
  }, []);

  const handleToggle = async (newEnabled: boolean) => {
    setEnabled(newEnabled);
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature_key: featureKey, enabled: newEnabled, config }),
      });
      if (!res.ok) throw new Error('Failed');
      await onSave?.(config, newEnabled);
      onToggle?.(newEnabled);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
      setEnabled(!newEnabled); // revert
    }
  };

  const handleSave = async () => {
    setSaveStatus('saving');
    try {
      const res = await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature_key: featureKey, enabled, config }),
      });
      if (!res.ok) throw new Error('Failed');
      onSave?.(config, enabled);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch {
      setSaveStatus('error');
    }
  };

  const statusText = {
    idle: '',
    saving: '⏳ Saving...',
    saved: '✅ Saved',
    error: '❌ Save failed',
  }[saveStatus];

  return (
    <div
      className={`feature-card ${enabled ? 'is-active' : ''}`}
      id={`feature-card-${id}`}
    >
      {/* Header — always visible */}
      <div className="feature-card-header" onClick={() => enabled && null}>
        <div className="feature-card-meta">
          <div className="feature-card-icon">{icon}</div>
          <div>
            <div className="feature-card-title">{title}</div>
            <div className="feature-card-desc">{description}</div>
          </div>
        </div>

        <div className="toggle-wrap">
          <span className={`toggle-label ${enabled ? 'on' : ''}`}>
            {enabled ? 'ON' : 'OFF'}
          </span>
          <label className="toggle" id={`toggle-${id}`}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => handleToggle(e.target.checked)}
              aria-label={`Toggle ${title}`}
            />
            <div className="toggle-track" />
            <div className="toggle-thumb" />
          </label>
        </div>
      </div>

      {/* Accordion body — revealed when enabled */}
      <div className={`feature-card-body ${enabled ? 'open' : ''}`}>
        <div className="feature-card-content">
          {children && children(config, setConfig)}

          <div className="save-bar" style={{ margin: '0 -1.5rem -1.5rem', borderRadius: '0 0 var(--radius-lg) var(--radius-lg)' }}>
            <span className={`save-bar-status ${saveStatus}`}>{statusText}</span>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              id={`save-btn-${id}`}
            >
              {saveStatus === 'saving' ? (
                <><span className="spinner" style={{ width: 14, height: 14 }} /> Saving</>
              ) : (
                '💾 Save Config'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
