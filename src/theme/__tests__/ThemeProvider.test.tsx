import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider, useTheme } from '../ThemeProvider';
import { tokens } from '../tokens';

function TestComponent() {
  const themeTokens = useTheme();
  return (
    <div data-testid="test-component">
      <span data-testid="bg-primary">{themeTokens.colors.bgPrimary}</span>
      <span data-testid="text-primary">{themeTokens.colors.textPrimary}</span>
      <span data-testid="accent">{themeTokens.colors.accent}</span>
    </div>
  );
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  afterEach(() => {
    document.documentElement.removeAttribute('data-theme');
  });

  it('renders children', () => {
    render(
      <ThemeProvider>
        <div data-testid="child">Child content</div>
      </ThemeProvider>
    );
    expect(screen.getByTestId('child')).toBeTruthy();
    expect(screen.getByText('Child content')).toBeTruthy();
  });

  it('applies data-theme="dark-frosted" to document', () => {
    render(
      <ThemeProvider>
        <div>Test</div>
      </ThemeProvider>
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark-frosted');
  });

  it('injects CSS variables onto root element', () => {
    render(
      <ThemeProvider>
        <div>Test</div>
      </ThemeProvider>
    );

    const styleSheets = Array.from(document.styleSheets);
    const themeStylesheet = styleSheets.find((sheet) => {
      try {
        const rules = Array.from(sheet.cssRules || []);
        return rules.some((rule) => 
          rule instanceof CSSStyleRule && 
          rule.selectorText === ':root[data-theme="dark-frosted"]'
        );
      } catch {
        return false;
      }
    });

    expect(themeStylesheet).toBeTruthy();
  });

  it('useTheme hook returns correct tokens', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    );

    expect(screen.getByTestId('bg-primary').textContent).toBe(tokens.colors.bgPrimary);
    expect(screen.getByTestId('text-primary').textContent).toBe(tokens.colors.textPrimary);
    expect(screen.getByTestId('accent').textContent).toBe(tokens.colors.accent);
  });

  it('useTheme throws error when used outside ThemeProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    
    expect(() => {
      render(<TestComponent />);
    }).toThrow('useTheme must be used within a ThemeProvider');
    
    consoleError.mockRestore();
  });
});
