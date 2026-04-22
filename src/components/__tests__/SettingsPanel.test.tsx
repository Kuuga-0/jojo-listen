import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsPanel } from '../SettingsPanel';

const mockInvoke = vi.fn().mockResolvedValue(null);
const mockGetItem = vi.fn().mockResolvedValue(null);
const mockSaveItem = vi.fn().mockResolvedValue(undefined);
const mockRemoveItem = vi.fn().mockResolvedValue(undefined);

vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

vi.mock('tauri-plugin-keychain', () => ({
  getItem: (...args: unknown[]) => mockGetItem(...args),
  saveItem: (...args: unknown[]) => mockSaveItem(...args),
  removeItem: (...args: unknown[]) => mockRemoveItem(...args),
}));

describe('SettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInvoke.mockResolvedValue(null);
    mockGetItem.mockResolvedValue(null);
    mockSaveItem.mockResolvedValue(undefined);
    mockRemoveItem.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(
        <SettingsPanel isOpen={false} onClose={vi.fn()} />
      );
      expect(container.firstChild).toBeNull();
    });

    it('renders overlay and panel when isOpen is true', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-overlay')).toBeTruthy();
        expect(screen.getByTestId('settings-panel')).toBeTruthy();
      });
    });

    it('renders all three tabs', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('tab-llm')).toBeTruthy();
        expect(screen.getByTestId('tab-keybindings')).toBeTruthy();
        expect(screen.getByTestId('tab-display')).toBeTruthy();
      });
    });

    it('renders LLM Config tab content by default', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('llm-config-content')).toBeTruthy();
        expect(screen.getByTestId('api-url-input')).toBeTruthy();
        expect(screen.getByTestId('model-input')).toBeTruthy();
        expect(screen.getByTestId('api-key-input')).toBeTruthy();
      });
    });

    it('renders keybindings tab content when clicked', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('tab-keybindings')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('tab-keybindings'));

      await waitFor(() => {
        expect(screen.getByTestId('keybindings-content')).toBeTruthy();
      });
    });

    it('renders display tab content when clicked', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('tab-display')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('tab-display'));

      await waitFor(() => {
        expect(screen.getByTestId('display-content')).toBeTruthy();
        expect(screen.getByTestId('subtitle-mode-select')).toBeTruthy();
        expect(screen.getByTestId('playback-speed-select')).toBeTruthy();
        expect(screen.getByTestId('osd-toggle')).toBeTruthy();
      });
    });

    it('has Save and Cancel buttons in footer', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('save-button')).toBeTruthy();
        expect(screen.getByTestId('cancel-button')).toBeTruthy();
      });
    });

    it('has close button in header', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('close-settings-button')).toBeTruthy();
      });
    });
  });

  describe('LLM Config Tab', () => {
    it('loads settings on mount', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('get_setting', { key: 'api_url' });
        expect(mockInvoke).toHaveBeenCalledWith('get_setting', { key: 'model' });
        expect(mockInvoke).toHaveBeenCalledWith('get_setting', { key: 'subtitle_mode' });
        expect(mockInvoke).toHaveBeenCalledWith('get_setting', { key: 'playback_speed' });
        expect(mockInvoke).toHaveBeenCalledWith('get_setting', { key: 'osd_enabled' });
      });
    });

    it('loads API key from keychain on mount', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(mockGetItem).toHaveBeenCalledWith('jojo-listen-api-key');
      });
    });

    it('displays API key input with masked value when key exists', async () => {
      mockGetItem.mockResolvedValue('sk-test123456789');

      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('api-key-input')).toBeTruthy();
      });

      await waitFor(() => {
        expect(screen.getByText('Current: ************')).toBeTruthy();
      });
    });

    it('shows clear button when API key exists', async () => {
      mockGetItem.mockResolvedValue('sk-test123456789');

      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('clear-api-key-button')).toBeTruthy();
      });
    });

    it('does not show clear button when API key is empty', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.queryByTestId('clear-api-key-button')).toBeNull();
      });
    });

    it('has Test Connection button', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('test-connection-button')).toBeTruthy();
      });
    });

    it('accepts input in API URL field', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('api-url-input')).toBeTruthy();
      });

      const input = screen.getByTestId('api-url-input');
      fireEvent.change(input, { target: { value: 'https://api.test.com' } });

      expect((input as HTMLInputElement).value).toBe('https://api.test.com');
    });

    it('accepts input in Model field', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('model-input')).toBeTruthy();
      });

      const input = screen.getByTestId('model-input');
      fireEvent.change(input, { target: { value: 'gpt-4o' } });

      expect((input as HTMLInputElement).value).toBe('gpt-4o');
    });

    it('accepts input in API Key field', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('api-key-input')).toBeTruthy();
      });

      const input = screen.getByTestId('api-key-input');
      fireEvent.change(input, { target: { value: 'sk-newkey123' } });

      expect((input as HTMLInputElement).value).toBe('sk-newkey123');
    });

    it('clears API key when clear button is clicked', async () => {
      mockGetItem.mockResolvedValue('sk-test123456789');

      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('clear-api-key-button')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('clear-api-key-button'));

      await waitFor(() => {
        expect(mockRemoveItem).toHaveBeenCalledWith('jojo-listen-api-key');
      });
    });
  });

  describe('Keybindings Tab', () => {
    it('displays all keyboard shortcuts', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('tab-keybindings')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('tab-keybindings'));

      await waitFor(() => {
        expect(screen.getByTestId('keybindings-content')).toBeTruthy();
        expect(screen.getByText('Play / Pause')).toBeTruthy();
        expect(screen.getByText('Seek backward 5s')).toBeTruthy();
        expect(screen.getByText('Seek forward 5s')).toBeTruthy();
        expect(screen.getByText('Previous subtitle')).toBeTruthy();
        expect(screen.getByText('Next subtitle')).toBeTruthy();
        expect(screen.getByText('Set A point')).toBeTruthy();
        expect(screen.getByText('Set B point')).toBeTruthy();
        expect(screen.getByText('Toggle A-B Loop')).toBeTruthy();
        expect(screen.getByText('Clear A-B Loop')).toBeTruthy();
        expect(screen.getByText('Decrease playback speed')).toBeTruthy();
        expect(screen.getByText('Increase playback speed')).toBeTruthy();
        expect(screen.getByText('Toggle stealth mode')).toBeTruthy();
        expect(screen.getByText('Toggle click-through')).toBeTruthy();
        expect(screen.getByText('Open settings')).toBeTruthy();
        expect(screen.getByText('Close / Exit')).toBeTruthy();
      });
    });

    it('displays keyboard keys in kbd elements', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('tab-keybindings')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('tab-keybindings'));

      await waitFor(() => {
        const kbdElements = document.querySelectorAll('kbd');
        const spaceKbd = Array.from(kbdElements).find(el => el.textContent === 'Space');
        expect(spaceKbd).toBeTruthy();
      });
    });
  });

  describe('Display Tab', () => {
    it('renders subtitle mode dropdown with all options', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('tab-display')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('tab-display'));

      await waitFor(() => {
        const select = screen.getByTestId('subtitle-mode-select') as HTMLSelectElement;
        expect(select).toBeTruthy();
        expect(select.options).toHaveLength(4);
        expect(select.options[0].value).toBe('word-segmented');
        expect(select.options[1].value).toBe('word-segmented-translation');
        expect(select.options[2].value).toBe('plain');
        expect(select.options[3].value).toBe('plain-translation');
      });
    });

    it('renders playback speed dropdown with all options', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('tab-display')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('tab-display'));

      await waitFor(() => {
        const select = screen.getByTestId('playback-speed-select') as HTMLSelectElement;
        expect(select).toBeTruthy();
        expect(select.options).toHaveLength(5);
        expect(select.options[0].value).toBe('0.5');
        expect(select.options[1].value).toBe('0.75');
        expect(select.options[2].value).toBe('1');
        expect(select.options[3].value).toBe('1.25');
        expect(select.options[4].value).toBe('1.5');
      });
    });

    it('renders OSD toggle checkbox', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('tab-display')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('tab-display'));

      await waitFor(() => {
        const toggle = screen.getByTestId('osd-toggle') as HTMLInputElement;
        expect(toggle).toBeTruthy();
        expect(toggle.type).toBe('checkbox');
      });
    });

    it('changes subtitle mode when dropdown changes', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('tab-display')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('tab-display'));

      await waitFor(() => {
        const select = screen.getByTestId('subtitle-mode-select') as HTMLSelectElement;
        fireEvent.change(select, { target: { value: 'plain' } });
        expect(select.value).toBe('plain');
      });
    });

    it('changes playback speed when dropdown changes', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('tab-display')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('tab-display'));

      await waitFor(() => {
        const select = screen.getByTestId('playback-speed-select') as HTMLSelectElement;
        fireEvent.change(select, { target: { value: '1.25' } });
        expect(select.value).toBe('1.25');
      });
    });

    it('toggles OSD checkbox', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('tab-display')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('tab-display'));

      await waitFor(() => {
        const toggle = screen.getByTestId('osd-toggle') as HTMLInputElement;
        expect(toggle.checked).toBe(true);
        fireEvent.click(toggle);
        expect(toggle.checked).toBe(false);
      });
    });
  });

  describe('Save and Cancel', () => {
    it('calls onClose when Cancel button is clicked', async () => {
      const onClose = vi.fn();
      render(<SettingsPanel isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('cancel-button')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('cancel-button'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('calls onClose when close button is clicked', async () => {
      const onClose = vi.fn();
      render(<SettingsPanel isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('close-settings-button')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('close-settings-button'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('saves settings and calls onClose when Save button is clicked', async () => {
      const onClose = vi.fn();

      render(<SettingsPanel isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('save-button')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith('set_setting', { key: 'api_url', value: expect.any(String) });
        expect(mockInvoke).toHaveBeenCalledWith('set_setting', { key: 'model', value: expect.any(String) });
        expect(mockInvoke).toHaveBeenCalledWith('set_setting', { key: 'subtitle_mode', value: expect.any(String) });
        expect(mockInvoke).toHaveBeenCalledWith('set_setting', { key: 'playback_speed', value: expect.any(String) });
        expect(mockInvoke).toHaveBeenCalledWith('set_setting', { key: 'osd_enabled', value: expect.any(String) });
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('saves API key to keychain when save is clicked', async () => {
      const onClose = vi.fn();

      render(<SettingsPanel isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('api-key-input')).toBeTruthy();
      });

      fireEvent.change(screen.getByTestId('api-key-input'), { target: { value: 'sk-newkey123' } });

      await waitFor(() => {
        expect(screen.getByTestId('save-button')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(mockSaveItem).toHaveBeenCalledWith('jojo-listen-api-key', 'sk-newkey123');
      });
    });

    it('does not save API key when key is empty', async () => {
      const onClose = vi.fn();

      render(<SettingsPanel isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('save-button')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(mockSaveItem).not.toHaveBeenCalled();
      });
    });

    it('shows saving state when isSaving is true', async () => {
      mockInvoke.mockImplementation(() => new Promise(() => {}));
      const onClose = vi.fn();

      render(<SettingsPanel isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('save-button')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('save-button'));

      await waitFor(() => {
        expect(screen.getByText('Saving...')).toBeTruthy();
      });
    });
  });

  describe('Connection Test', () => {
    it('shows success message when connection test succeeds', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
      }));

      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('api-key-input')).toBeTruthy();
      });

      fireEvent.change(screen.getByTestId('api-key-input'), { target: { value: 'sk-test' } });

      await waitFor(() => {
        expect(screen.getByTestId('test-connection-button')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('test-connection-button'));

      await waitFor(() => {
        expect(screen.getByTestId('connection-success')).toBeTruthy();
      }, { timeout: 3000 });

      vi.stubGlobal('fetch', undefined);
    });

    it('shows error message when connection test fails', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
      }));

      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('api-key-input')).toBeTruthy();
      });

      fireEvent.change(screen.getByTestId('api-key-input'), { target: { value: 'sk-invalid' } });

      await waitFor(() => {
        expect(screen.getByTestId('test-connection-button')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('test-connection-button'));

      await waitFor(() => {
        expect(screen.getByTestId('connection-error')).toBeTruthy();
      }, { timeout: 3000 });

      vi.stubGlobal('fetch', undefined);
    });

    it('disables test button when API key is empty', async () => {
      render(<SettingsPanel isOpen={true} onClose={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByTestId('test-connection-button')).toBeTruthy();
      });

      const button = screen.getByTestId('test-connection-button') as HTMLButtonElement;
      expect(button.disabled).toBe(true);
    });
  });

  describe('Overlay behavior', () => {
    it('closes when overlay is clicked', async () => {
      const onClose = vi.fn();
      render(<SettingsPanel isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-overlay')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('settings-overlay'));

      await waitFor(() => {
        expect(onClose).toHaveBeenCalledTimes(1);
      });
    });

    it('does not close when panel is clicked', async () => {
      const onClose = vi.fn();
      render(<SettingsPanel isOpen={true} onClose={onClose} />);

      await waitFor(() => {
        expect(screen.getByTestId('settings-panel')).toBeTruthy();
      });

      fireEvent.click(screen.getByTestId('settings-panel'));

      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
