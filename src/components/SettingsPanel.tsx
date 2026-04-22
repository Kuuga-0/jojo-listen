import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getItem, saveItem, removeItem } from 'tauri-plugin-keychain';

export type SubtitleMode = 'word-segmented' | 'word-segmented-translation' | 'plain' | 'plain-translation';
export type PlaybackSpeed = 0.5 | 0.75 | 1.0 | 1.25 | 1.5;

const API_KEY_ID = 'jojo-listen-api-key';

interface Settings {
  apiUrl: string;
  model: string;
  subtitleMode: SubtitleMode;
  playbackSpeed: PlaybackSpeed;
  osdEnabled: boolean;
}

const DEFAULT_SETTINGS: Settings = {
  apiUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  subtitleMode: 'word-segmented',
  playbackSpeed: 1.0,
  osdEnabled: true,
};

interface Keybinding {
  key: string;
  description: string;
}

const KEYBINDINGS: Keybinding[] = [
  { key: 'Space', description: 'Play / Pause' },
  { key: 'ArrowLeft', description: 'Seek backward 5s' },
  { key: 'ArrowRight', description: 'Seek forward 5s' },
  { key: 'ArrowUp', description: 'Previous subtitle' },
  { key: 'ArrowDown', description: 'Next subtitle' },
  { key: '1', description: 'Set A point' },
  { key: '2', description: 'Set B point' },
  { key: '3', description: 'Toggle A-B Loop' },
  { key: '4', description: 'Clear A-B Loop' },
  { key: '[', description: 'Decrease playback speed' },
  { key: ']', description: 'Increase playback speed' },
  { key: 's', description: 'Toggle stealth mode' },
  { key: 't', description: 'Toggle click-through' },
  { key: ',', description: 'Open settings' },
  { key: 'Escape', description: 'Close / Exit' },
];

export interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type Tab = 'llm' | 'keybindings' | 'display';

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState<Tab>('llm');
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyMasked, setApiKeyMasked] = useState('');
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestResult, setConnectionTestResult] = useState<'success' | 'error' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadSettings();
      loadApiKey();
    }
  }, [isOpen]);

  const loadSettings = async () => {
    try {
      const [apiUrl, model, subtitleMode, playbackSpeed, osdEnabled] = await Promise.all([
        invoke<string | null>('get_setting', { key: 'api_url' }),
        invoke<string | null>('get_setting', { key: 'model' }),
        invoke<string | null>('get_setting', { key: 'subtitle_mode' }),
        invoke<string | null>('get_setting', { key: 'playback_speed' }),
        invoke<string | null>('get_setting', { key: 'osd_enabled' }),
      ]);

      setSettings({
        apiUrl: apiUrl ?? DEFAULT_SETTINGS.apiUrl,
        model: model ?? DEFAULT_SETTINGS.model,
        subtitleMode: (subtitleMode as SubtitleMode) ?? DEFAULT_SETTINGS.subtitleMode,
        playbackSpeed: playbackSpeed ? parseFloat(playbackSpeed) as PlaybackSpeed : DEFAULT_SETTINGS.playbackSpeed,
        osdEnabled: osdEnabled !== 'false',
      });
    } catch (err) {
      console.error('Failed to load settings:', err);
    }
  };

  const loadApiKey = async () => {
    try {
      const key = await getItem(API_KEY_ID);
      if (key) {
        setApiKey(key);
        setApiKeyMasked('*'.repeat(Math.min(key.length, 12)));
      } else {
        setApiKey('');
        setApiKeyMasked('');
      }
    } catch (err) {
      console.error('Failed to load API key:', err);
    }
  };

  const testConnection = useCallback(async () => {
    setIsTestingConnection(true);
    setConnectionTestResult(null);
    setError(null);

    try {
      const testResponse = await fetch(`${settings.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 5,
        }),
      });

      if (testResponse.ok) {
        setConnectionTestResult('success');
      } else if (testResponse.status === 401) {
        setError('Invalid API key');
        setConnectionTestResult('error');
      } else {
        setError(`Connection failed: ${testResponse.status}`);
        setConnectionTestResult('error');
      }
    } catch (err) {
      setError('Connection failed: Network error');
      setConnectionTestResult('error');
    } finally {
      setIsTestingConnection(false);
    }
  }, [settings.apiUrl, settings.model, apiKey]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    setError(null);

    try {
      await Promise.all([
        invoke('set_setting', { key: 'api_url', value: settings.apiUrl }),
        invoke('set_setting', { key: 'model', value: settings.model }),
        invoke('set_setting', { key: 'subtitle_mode', value: settings.subtitleMode }),
        invoke('set_setting', { key: 'playback_speed', value: String(settings.playbackSpeed) }),
        invoke('set_setting', { key: 'osd_enabled', value: String(settings.osdEnabled) }),
      ]);

      if (apiKey) {
        await saveItem(API_KEY_ID, apiKey);
      }

      onClose();
    } catch (err) {
      setError(`Failed to save settings: ${err}`);
    } finally {
      setIsSaving(false);
    }
  }, [settings, apiKey, onClose]);

  const handleClearApiKey = useCallback(async () => {
    try {
      await removeItem(API_KEY_ID);
      setApiKey('');
      setApiKeyMasked('');
    } catch (err) {
      console.error('Failed to clear API key:', err);
    }
  }, []);

  if (!isOpen) {
    return null;
  }

  return (
    <div style={styles.overlay} onClick={onClose} data-testid="settings-overlay">
      <div style={styles.panel} onClick={(e) => e.stopPropagation()} data-testid="settings-panel">
        <div style={styles.header}>
          <h2 style={styles.title}>Settings</h2>
          <button style={styles.closeButton} onClick={onClose} aria-label="Close settings" data-testid="close-settings-button">
            ✕
          </button>
        </div>

        <div style={styles.tabs} role="tablist" data-testid="settings-tabs">
          <button
            style={{ ...styles.tab, ...(activeTab === 'llm' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('llm')}
            role="tab"
            aria-selected={activeTab === 'llm'}
            data-testid="tab-llm"
          >
            LLM Config
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === 'keybindings' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('keybindings')}
            role="tab"
            aria-selected={activeTab === 'keybindings'}
            data-testid="tab-keybindings"
          >
            Keybindings
          </button>
          <button
            style={{ ...styles.tab, ...(activeTab === 'display' ? styles.tabActive : {}) }}
            onClick={() => setActiveTab('display')}
            role="tab"
            aria-selected={activeTab === 'display'}
            data-testid="tab-display"
          >
            Display
          </button>
        </div>

        <div style={styles.content} role="tabpanel" data-testid={`tab-content-${activeTab}`}>
          {activeTab === 'llm' && (
            <div style={styles.tabContent} data-testid="llm-config-content">
              <div style={styles.field}>
                <label style={styles.label} htmlFor="api-url">API URL</label>
                <input
                  id="api-url"
                  type="text"
                  value={settings.apiUrl}
                  onChange={(e) => setSettings({ ...settings, apiUrl: e.target.value })}
                  style={styles.input}
                  placeholder="https://api.openai.com/v1"
                  data-testid="api-url-input"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="model">Model</label>
                <input
                  id="model"
                  type="text"
                  value={settings.model}
                  onChange={(e) => setSettings({ ...settings, model: e.target.value })}
                  style={styles.input}
                  placeholder="gpt-4o-mini"
                  data-testid="model-input"
                />
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="api-key">API Key</label>
                <div style={styles.apiKeyContainer}>
                  <input
                    id="api-key"
                    type="password"
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setApiKeyMasked(e.target.value ? '*'.repeat(Math.min(e.target.value.length, 12)) : '');
                    }}
                    style={styles.input}
                    placeholder="Enter API key"
                    data-testid="api-key-input"
                  />
                  {apiKeyMasked && (
                    <button
                      style={styles.clearButton}
                      onClick={handleClearApiKey}
                      data-testid="clear-api-key-button"
                      type="button"
                    >
                      Clear
                    </button>
                  )}
                </div>
                {apiKeyMasked && <div style={styles.maskedKey}>Current: {apiKeyMasked}</div>}
              </div>

              <div style={styles.buttonRow}>
                <button
                  style={styles.testButton}
                  onClick={testConnection}
                  disabled={isTestingConnection || !apiKey}
                  data-testid="test-connection-button"
                  type="button"
                >
                  {isTestingConnection ? 'Testing...' : 'Test Connection'}
                </button>
              </div>

              {connectionTestResult === 'success' && (
                <div style={styles.successMessage} data-testid="connection-success">Connection successful!</div>
              )}
              {connectionTestResult === 'error' && (
                <div style={styles.errorMessage} data-testid="connection-error">{error || 'Connection failed'}</div>
              )}
            </div>
          )}

          {activeTab === 'keybindings' && (
            <div style={styles.tabContent} data-testid="keybindings-content">
              <div style={styles.keybindingList}>
                {KEYBINDINGS.map((binding) => (
                  <div key={binding.key} style={styles.keybindingItem} data-testid={`keybinding-${binding.key.toLowerCase().replace(/\s/g, '-')}`}>
                    <kbd style={styles.key}>{binding.key}</kbd>
                    <span style={styles.keyDescription}>{binding.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'display' && (
            <div style={styles.tabContent} data-testid="display-content">
              <div style={styles.field}>
                <label style={styles.label} htmlFor="subtitle-mode">Default Subtitle Mode</label>
                <select
                  id="subtitle-mode"
                  value={settings.subtitleMode}
                  onChange={(e) => setSettings({ ...settings, subtitleMode: e.target.value as SubtitleMode })}
                  style={styles.select}
                  data-testid="subtitle-mode-select"
                >
                  <option value="word-segmented">Word Segmented</option>
                  <option value="word-segmented-translation">Word Segmented + Translation</option>
                  <option value="plain">Plain Text</option>
                  <option value="plain-translation">Plain Text + Translation</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.label} htmlFor="playback-speed">Default Playback Speed</label>
                <select
                  id="playback-speed"
                  value={settings.playbackSpeed}
                  onChange={(e) => setSettings({ ...settings, playbackSpeed: parseFloat(e.target.value) as PlaybackSpeed })}
                  style={styles.select}
                  data-testid="playback-speed-select"
                >
                  <option value="0.5">0.5x</option>
                  <option value="0.75">0.75x</option>
                  <option value="1">1.0x</option>
                  <option value="1.25">1.25x</option>
                  <option value="1.5">1.5x</option>
                </select>
              </div>

              <div style={styles.field}>
                <label style={styles.checkboxLabel}>
                  <input
                    type="checkbox"
                    checked={settings.osdEnabled}
                    onChange={(e) => setSettings({ ...settings, osdEnabled: e.target.checked })}
                    style={styles.checkbox}
                    data-testid="osd-toggle"
                  />
                  Enable On-Screen Display (OSD)
                </label>
              </div>
            </div>
          )}
        </div>

        {error && activeTab !== 'llm' && (
          <div style={styles.errorMessage} data-testid="settings-error">{error}</div>
        )}

        <div style={styles.footer}>
          <button style={styles.cancelButton} onClick={onClose} data-testid="cancel-button" type="button">
            Cancel
          </button>
          <button style={styles.saveButton} onClick={handleSave} disabled={isSaving} data-testid="save-button" type="button">
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'fixed',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'var(--overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    zIndex: 200,
  },
  panel: {
    width: '480px',
    maxWidth: '100%',
    height: '100%',
    backgroundColor: 'var(--bg-primary)',
    backdropFilter: 'var(--blur-md)',
    WebkitBackdropFilter: 'var(--blur-md)',
    borderRadius: '16px 0 0 16px',
    boxShadow: 'var(--shadow-card)',
    border: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 24px',
    borderBottom: '1px solid var(--border)',
  },
  title: {
    color: 'var(--text-primary)',
    fontSize: '20px',
    fontWeight: 600,
    margin: 0,
  },
  closeButton: {
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    border: 'none',
    backgroundColor: 'var(--border)',
    color: 'var(--text-secondary)',
    fontSize: '16px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color 200ms ease',
  },
  tabs: {
    display: 'flex',
    padding: '0 24px',
    borderBottom: '1px solid var(--border)',
  },
  tab: {
    padding: '12px 16px',
    backgroundColor: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    borderBottom: '2px solid transparent',
    transition: 'all 200ms ease',
    marginBottom: '-1px',
  },
  tabActive: {
    color: 'var(--accent)',
    borderBottomColor: 'var(--accent)',
  },
  content: {
    flex: 1,
    overflow: 'auto',
    padding: '24px',
  },
  tabContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    color: 'var(--text-secondary)',
    fontSize: '14px',
    fontWeight: 500,
  },
  input: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 200ms ease',
  },
  select: {
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--input-bg)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer',
  },
  apiKeyContainer: {
    display: 'flex',
    gap: '8px',
    alignItems: 'center',
  },
  clearButton: {
    padding: '8px 12px',
    borderRadius: '6px',
    border: '1px solid var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '12px',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  maskedKey: {
    color: 'var(--accent)',
    fontSize: '12px',
    marginTop: '4px',
  },
  buttonRow: {
    display: 'flex',
    gap: '12px',
  },
  testButton: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
    color: 'var(--accent)',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 200ms ease',
  },
  successMessage: {
    color: 'var(--success)',
    fontSize: '14px',
    padding: '8px 12px',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    borderRadius: '6px',
  },
  errorMessage: {
    color: 'var(--error)',
    fontSize: '14px',
    padding: '8px 12px',
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderRadius: '6px',
  },
  keybindingList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  keybindingItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    padding: '8px 12px',
    backgroundColor: 'var(--input-bg)',
    borderRadius: '8px',
  },
  key: {
    padding: '6px 12px',
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
    color: 'var(--accent)',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    minWidth: '60px',
    textAlign: 'center',
    fontFamily: 'monospace',
  },
  keyDescription: {
    color: 'var(--text-primary)',
    fontSize: '14px',
  },
  checkboxLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    color: 'var(--text-primary)',
    fontSize: '14px',
    cursor: 'pointer',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: '12px',
    padding: '20px 24px',
    borderTop: '1px solid var(--border)',
  },
  cancelButton: {
    padding: '10px 20px',
    borderRadius: '8px',
    border: '1px solid var(--border)',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 200ms ease',
  },
  saveButton: {
    padding: '10px 24px',
    borderRadius: '8px',
    border: 'none',
    backgroundColor: 'var(--accent)',
    color: 'white',
    fontSize: '14px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'background-color 200ms ease',
  },
};

export default SettingsPanel;