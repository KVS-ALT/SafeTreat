"use client";
import { createContext, useCallback, useContext, useState } from "react";
import { THEME_COOKIE, type ThemeId } from "@/lib/themes";

const Ctx = createContext<{ theme: ThemeId; setTheme: (t: ThemeId) => void }>({ theme: "nightfall", setTheme: () => {} });

export function ThemeProvider({ initial, children }: { initial: ThemeId; children: React.ReactNode }) {
  const [theme, set] = useState<ThemeId>(initial);
  const setTheme = useCallback((t: ThemeId) => {
    set(t);
    document.documentElement.dataset.theme = t;
    document.cookie = `${THEME_COOKIE}=${t}; path=/; max-age=31536000; samesite=lax`;
  }, []);
  return <Ctx.Provider value={{ theme, setTheme }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
