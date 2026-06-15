import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { theme as antdTheme } from 'antd';
import type { ThemeConfig } from 'antd';

const STORAGE_DARK = 'dark-mode';
const STORAGE_ULTRA = 'isUltraDarkThemeEnabled';
const STORAGE_ULTRA_BLACK = 'isUltraBlackThemeEnabled';

function readBool(key: string, fallback: boolean): boolean {
  const raw = localStorage.getItem(key);
  if (raw === null) return fallback;
  return raw === 'true';
}

function applyDom(isDark: boolean, isUltra: boolean, isUltraBlack: boolean) {
  document.body.setAttribute('class', isDark ? 'dark' : 'light');
  if (isUltraBlack) {
    document.documentElement.setAttribute('data-theme', 'ultra-black');
  } else if (isUltra) {
    document.documentElement.setAttribute('data-theme', 'ultra-dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  const msg = document.getElementById('message');
  if (msg) msg.className = isDark ? 'dark' : 'light';
}

// module load so the document is in the right theme before React mounts.
const initialDark = readBool(STORAGE_DARK, true);
const initialUltra = readBool(STORAGE_ULTRA, false);
const initialUltraBlack = initialDark && initialUltra && readBool(STORAGE_ULTRA_BLACK, false);
applyDom(initialDark, initialUltra, initialUltraBlack);

const DARK_TOKENS = {
  colorBgBase: '#0d0f1a',
  colorBgLayout: 'transparent',
  colorBgContainer: 'rgba(255, 255, 255, 0.04)',
  colorBgElevated: 'rgba(20, 22, 40, 0.88)',
  colorPrimary: '#6366f1',
  borderRadius: 12,
  borderRadiusLG: 16,
  borderRadiusSM: 8,
};
const ULTRA_DARK_TOKENS = {
  colorBgBase: '#050508',
  colorBgLayout: 'transparent',
  colorBgContainer: 'rgba(255, 255, 255, 0.03)',
  colorBgElevated: 'rgba(8, 8, 18, 0.92)',
  colorPrimary: '#818cf8',
  borderRadius: 12,
  borderRadiusLG: 16,
  borderRadiusSM: 8,
};
const ULTRA_BLACK_TOKENS = {
  colorBgBase: '#020203',
  colorBgLayout: 'transparent',
  colorBgContainer: 'rgba(255, 255, 255, 0.02)',
  colorBgElevated: 'rgba(4, 4, 6, 0.95)',
  colorPrimary: '#818cf8',
  borderRadius: 12,
  borderRadiusLG: 16,
  borderRadiusSM: 8,
};
const DARK_LAYOUT_TOKENS = {
  bodyBg: 'transparent',
  headerBg: 'rgba(13, 15, 26, 0.65)',
  headerColor: '#ffffff',
  footerBg: 'transparent',
  siderBg: 'rgba(13, 15, 26, 0.65)',
  triggerBg: 'rgba(255, 255, 255, 0.08)',
  triggerColor: '#ffffff',
};
const ULTRA_DARK_LAYOUT_TOKENS = {
  bodyBg: 'transparent',
  headerBg: 'rgba(5, 5, 12, 0.75)',
  headerColor: '#ffffff',
  footerBg: 'transparent',
  siderBg: 'rgba(5, 5, 12, 0.75)',
  triggerBg: 'rgba(255, 255, 255, 0.06)',
  triggerColor: '#ffffff',
};
const ULTRA_BLACK_LAYOUT_TOKENS = {
  bodyBg: 'transparent',
  headerBg: 'rgba(2, 2, 3, 0.85)',
  headerColor: '#ffffff',
  footerBg: 'transparent',
  siderBg: 'rgba(2, 2, 3, 0.85)',
  triggerBg: 'rgba(255, 255, 255, 0.04)',
  triggerColor: '#ffffff',
};
const DARK_MENU_TOKENS = {
  darkItemBg: 'transparent',
  darkSubMenuItemBg: 'transparent',
  darkPopupBg: 'rgba(20, 22, 40, 0.92)',
};
const ULTRA_DARK_MENU_TOKENS = {
  darkItemBg: 'transparent',
  darkSubMenuItemBg: 'transparent',
  darkPopupBg: 'rgba(8, 8, 18, 0.95)',
};
const ULTRA_BLACK_MENU_TOKENS = {
  darkItemBg: 'transparent',
  darkSubMenuItemBg: 'transparent',
  darkPopupBg: 'rgba(4, 4, 6, 0.98)',
};
const DARK_CARD_TOKENS = {
  colorBorderSecondary: 'rgba(255, 255, 255, 0.15)',
};
const ULTRA_DARK_CARD_TOKENS = {
  colorBorderSecondary: 'rgba(255, 255, 255, 0.05)',
};
const ULTRA_BLACK_CARD_TOKENS = {
  colorBorderSecondary: 'rgba(255, 255, 255, 0.04)',
};
const LIGHT_TOKENS = {
  colorPrimary: '#6366f1',
  colorBgLayout: 'transparent',
  colorBgContainer: 'rgba(255, 255, 255, 0.72)',
  colorBgElevated: 'rgba(255, 255, 255, 0.92)',
  borderRadius: 12,
  borderRadiusLG: 16,
  borderRadiusSM: 8,
};
const LIGHT_LAYOUT_TOKENS = {
  bodyBg: 'transparent',
  siderBg: 'rgba(255, 255, 255, 0.70)',
  headerBg: 'rgba(255, 255, 255, 0.70)',
  footerBg: 'transparent',
  triggerBg: 'rgba(99, 102, 241, 0.08)',
};
const LIGHT_CARD_TOKENS = {
  colorBorderSecondary: 'rgba(99, 102, 241, 0.10)',
};
const STATISTIC_TOKENS = {
  contentFontSize: 17,
  titleFontSize: 11,
};

export function buildAntdThemeConfig(isDark: boolean, isUltra: boolean, isUltraBlack: boolean): ThemeConfig {
  if (!isDark) {
    return {
      algorithm: antdTheme.defaultAlgorithm,
      token: LIGHT_TOKENS,
      components: {
        Layout: LIGHT_LAYOUT_TOKENS,
        Card: LIGHT_CARD_TOKENS,
        Statistic: STATISTIC_TOKENS,
      },
    };
  }
  return {
    algorithm: antdTheme.darkAlgorithm,
    token: isUltraBlack ? ULTRA_BLACK_TOKENS : isUltra ? ULTRA_DARK_TOKENS : DARK_TOKENS,
    components: {
      Layout: isUltraBlack ? ULTRA_BLACK_LAYOUT_TOKENS : isUltra ? ULTRA_DARK_LAYOUT_TOKENS : DARK_LAYOUT_TOKENS,
      Menu: isUltraBlack ? ULTRA_BLACK_MENU_TOKENS : isUltra ? ULTRA_DARK_MENU_TOKENS : DARK_MENU_TOKENS,
      Card: isUltraBlack ? ULTRA_BLACK_CARD_TOKENS : isUltra ? ULTRA_DARK_CARD_TOKENS : DARK_CARD_TOKENS,
      Statistic: STATISTIC_TOKENS,
    },
  };
}

export function pauseAnimationsUntilLeave(elementId: string): void {
  document.documentElement.setAttribute('data-theme-animations', 'off');
  const el = document.getElementById(elementId);
  if (!el) return;
  const restore = () => {
    document.documentElement.removeAttribute('data-theme-animations');
    el.removeEventListener('mouseleave', restore);
    el.removeEventListener('touchend', restore);
  };
  el.addEventListener('mouseleave', restore);
  el.addEventListener('touchend', restore);
}

interface ThemeContextValue {
  isDark: boolean;
  isUltra: boolean;
  isUltraBlack: boolean;
  cycleTheme: () => void;
  toggleTheme: () => void;
  toggleUltra: () => void;
  antdThemeConfig: ThemeConfig;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setIsDark] = useState<boolean>(initialDark);
  const [isUltra, setIsUltra] = useState<boolean>(initialUltra);
  const [isUltraBlack, setIsUltraBlack] = useState<boolean>(initialUltraBlack);

  useEffect(() => {
    applyDom(isDark, isUltra, isUltraBlack);
    localStorage.setItem(STORAGE_DARK, String(isDark));
    localStorage.setItem(STORAGE_ULTRA, String(isUltra));
    localStorage.setItem(STORAGE_ULTRA_BLACK, String(isUltraBlack));
  }, [isDark, isUltra, isUltraBlack]);

  // light → dark → ultra-dark → ultra-black → light
  const cycleTheme = useCallback(() => {
    if (!isDark) {
      setIsDark(true);
      setIsUltra(false);
      setIsUltraBlack(false);
    } else if (!isUltra) {
      setIsUltra(true);
      setIsUltraBlack(false);
    } else if (!isUltraBlack) {
      setIsUltraBlack(true);
    } else {
      setIsDark(false);
      setIsUltra(false);
      setIsUltraBlack(false);
    }
  }, [isDark, isUltra, isUltraBlack]);

  const toggleTheme = useCallback(() => setIsDark((v) => !v), []);
  const toggleUltra = useCallback(() => setIsUltra((v) => !v), []);

  const antdThemeConfig = useMemo(
    () => buildAntdThemeConfig(isDark, isUltra, isUltraBlack),
    [isDark, isUltra, isUltraBlack],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({ isDark, isUltra, isUltraBlack, cycleTheme, toggleTheme, toggleUltra, antdThemeConfig }),
    [isDark, isUltra, isUltraBlack, cycleTheme, toggleTheme, toggleUltra, antdThemeConfig],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
}
