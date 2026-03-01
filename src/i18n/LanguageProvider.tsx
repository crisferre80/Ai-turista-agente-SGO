"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { translations, locales, Locale } from './translations';

interface I18nContextType {
  locale: Locale;
  setLocale: (loc: Locale | 'auto') => void;
  t: (key: string, params?: Record<string, string | number>) => string;
}

const I18nContext = createContext<I18nContextType>({
  locale: 'es',
  setLocale: () => {},
  t: (key) => key,
});

export const LanguageProvider: React.FC<{
  children: React.ReactNode;
  initialLocale?: Locale;
}> = ({ children, initialLocale }) => {
  const detect = React.useCallback((): Locale => {
    // prefer initialLocale (from server) if valid
    if (initialLocale && locales.includes(initialLocale)) {
      return initialLocale;
    }
    // else try browser
    const nav = typeof navigator !== 'undefined' ? navigator.language.slice(0, 2) : '';
    if (locales.includes(nav as Locale)) {
      return nav as Locale;
    }
    return 'es';
  }, [initialLocale]);

  // On the server we cannot access localStorage, and on the client reading it during
  // render may lead to hydration mismatches if the saved locale differs from the
  // server-provided `initialLocale` (e.g. user previously chose EN but server used
  // Accept-Language ES). Instead we initialize with the server value or a detection
  // fallback, and only read localStorage after mounting.
  const getStartingLocale = (): Locale => {
    if (initialLocale && locales.includes(initialLocale)) {
      return initialLocale;
    }
    return detect();
  };

  const [locale, setLocaleState] = useState<Locale>(getStartingLocale);

  // After hydration, check localStorage and override if the user previously chose a
  // language. This runs only on the client and avoids SSR/CSR mismatch.
  // After hydration, read user preference from localStorage.  Using `locale` in
  // deps lets us satisfy the linter; the effect will run once initially and again
  // only if `locale` ever changes (which shouldn't happen before we read storage).
  useEffect(() => {
    try {
      const saved = localStorage.getItem('locale');
      if (saved && locales.includes(saved as Locale) && saved !== locale) {
        // update state asynchronously, not synchronously during render
        setTimeout(() => setLocaleState(saved as Locale), 0);
      }
    } catch {}
  }, [locale]);

  const setLocale = (loc: Locale | 'auto') => {
    if (loc === 'auto') {
      const detected = detect();
      setLocaleState(detected);
      try {
        localStorage.removeItem('locale');
      } catch {}
    } else {
      setLocaleState(loc);
      try {
        localStorage.setItem('locale', loc);
      } catch {}
    }
  };

  // update if initialLocale prop changes (e.g., during SSR navigation)

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const t = (key: string, params?: Record<string, string | number>): string => {
    let str =
      translations[locale]?.[key] || translations['es']?.[key] || key;
    if (params) {
      Object.entries(params).forEach(([k, v]) => {
        str = str.replace(new RegExp(`\{${k}\}`, 'g'), String(v));
      });
    }
    return str;
  };

  return (
    <I18nContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
