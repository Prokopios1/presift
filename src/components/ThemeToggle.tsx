import { useEffect, useState } from "react";
import { Button } from "./ui/button";
import { useI18n } from '@/contexts/I18nContext';
import { Tooltip, TooltipTrigger, TooltipContent } from "./ui/tooltip";

export function ThemeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<"light" | "dark">(
    () => (localStorage.getItem("theme") as "light" | "dark") || "light"
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
    localStorage.setItem("theme", theme);
  }, [theme]);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setTheme(theme === "light" ? "dark" : "light")}
        >
          {theme === "light" ? t("theme.dark", "🌙 Dark") : t("theme.light", "☀️ Light")}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{t("theme.toggle", "Toggle light / dark theme")}</TooltipContent>
    </Tooltip>
  );
}
