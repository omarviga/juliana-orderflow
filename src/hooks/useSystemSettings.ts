import { useState, useCallback } from "react";

export interface SystemSettings {
  businessName: string;
  businessPhone: string;
  businessAddress: string;
  businessCity: string;
  businessEmail: string;
  openTime: string;
  closeTime: string;
  currency: string;
  taxRate: number;
  theme: "light" | "dark" | "auto";
  language: "es" | "en";
}

const DEFAULT_SETTINGS: SystemSettings = {
  businessName: "JULIANA — BARRA COTIDIANA",
  businessPhone: "417 206 9111",
  businessAddress: "AV. MIGUEL HIDALGO #276, COL CENTRO, ACÁMBARO GTO.",
  businessCity: "Acámbaro, Gto.",
  businessEmail: "info@juliana.com",
  openTime: "09:00",
  closeTime: "22:00",
  currency: "MXN",
  taxRate: 0,
  theme: "auto",
  language: "es",
};

const HARD_CODED_BUSINESS: Pick<
  SystemSettings,
  "businessName" | "businessPhone" | "businessAddress" | "businessCity"
> = {
  businessName: "JULIANA — BARRA COTIDIANA",
  businessPhone: "417 206 9111",
  businessAddress: "AV. MIGUEL HIDALGO #276, COL CENTRO, ACÁMBARO GTO.",
  businessCity: "Acámbaro, Gto.",
};

const STORAGE_KEY = "systemSettings";

export function useSystemSettings() {
  const [settings, setSettings] = useState<SystemSettings>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const parsed = (stored && JSON.parse(stored)) || DEFAULT_SETTINGS;
    const hydrated = { ...parsed, ...HARD_CODED_BUSINESS };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(hydrated));
    return hydrated;
  });

  const updateSettings = useCallback((newSettings: Partial<SystemSettings>) => {
    setSettings((prev) => {
      const updated = { ...prev, ...newSettings, ...HARD_CODED_BUSINESS };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const resetToDefaults = useCallback(() => {
    setSettings(DEFAULT_SETTINGS);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_SETTINGS));
  }, []);

  return {
    settings,
    updateSettings,
    resetToDefaults,
  };
}
