import { createContext, useContext, useEffect, type ReactNode } from 'react';
import { tokens, cssVariables, type ThemeTokens } from './tokens';

interface ThemeContextValue {
  tokens: ThemeTokens;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', 'dark-frosted');

    const style = document.createElement('style');
    style.textContent = `
      :root[data-theme="dark-frosted"] {
        ${Object.entries(cssVariables)
          .map(([key, value]) => `${key}: ${value};`)
          .join('\n        ')}
      }
    `;
    document.head.appendChild(style);

    return () => {
      root.removeAttribute('data-theme');
      style.remove();
    };
  }, []);

  return (
    <ThemeContext.Provider value={{ tokens }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeTokens {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context.tokens;
}
