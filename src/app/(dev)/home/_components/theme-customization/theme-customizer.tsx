"use client";

import * as React from "react";
import { Sun, MoonStar, SunMoon, RotateCcw } from "lucide-react";

import { baseColors } from "@/configs/base-colors";

import type { ModeType } from "@/types";

import { useTheme } from "./hooks/use-theme";

import { Button } from "@/components/ui/button";

const themes = {
  zinc: {
    label: "Zinc",
    activeColor: {
      light: "240 5.9% 10%",
      dark: "240 5.2% 33.9%",
      foreground: "0 0% 98%",
    },
  },
  slate: {
    name: "slate",
    label: "Slate",
    activeColor: {
      light: "215.4 16.3% 46.9%",
      dark: "215.3 19.3% 34.5%",
      foreground: "210 40% 98%",
    },
  },
  stone: {
    label: "Stone",
    activeColor: {
      light: "25 5.3% 44.7%",
      dark: "33.3 5.5% 32.4%",
      foreground: "60 9.1% 97.8%",
    },
  },
  gray: {
    label: "Gray",
    activeColor: {
      light: "220 8.9% 46.1%",
      dark: "215 13.8% 34.1%",
      foreground: "210 20% 98%",
    },
  },
  neutral: {
    label: "Neutral",
    activeColor: {
      light: "0 0% 45.1%",
      dark: "0 0% 32.2%",
      foreground: "0 0% 98%",
    },
  },
  red: {
    name: "red",
    label: "Red",
    activeColor: {
      light: "0 72.2% 50.6%",
      dark: "0 72.2% 50.6%",
      foreground: "0 85.7% 97.3%",
    },
  },
  rose: {
    label: "Rose",
    activeColor: {
      light: "346.8 77.2% 49.8%",
      dark: "346.8 77.2% 49.8%",
      foreground: "355.7 100% 97.3%",
    },
  },
  orange: {
    label: "Orange",
    activeColor: {
      light: "24.6 95% 53.1%",
      dark: "20.5 90.2% 48.2%",
      foreground: "60 9.1% 97.8%",
    },
  },
  green: {
    label: "Green",
    activeColor: {
      light: "142.1 76.2% 36.3%",
      dark: "142.1 70.6% 45.3%",
      foreground: "355.7 100% 97.3%",
    },
  },
  blue: {
    label: "Blue",
    activeColor: {
      light: "221.2 83.2% 53.3%",
      dark: "217.2 91.2% 59.8%",
      foreground: "210 40% 98%",
    },
  },
  yellow: {
    label: "Yellow",
    activeColor: {
      light: "47.9 95.8% 53.1%",
      dark: "47.9 95.8% 53.1%",
      foreground: "26 83.3% 14.1%",
    },
  },
  violet: {
    label: "Violet",
    activeColor: {
      light: "262.1 83.3% 57.8%",
      dark: "263.4 70% 50.4%",
      foreground: "210 20% 98%",
    },
  },
};

const radiusSizes = ["0", "0.3", "0.5", "0.75", "1.0"];

export function ThemeCustomizer() {
  const { theme, updateTheme, resetTheme } = useTheme();

  const setMode = React.useCallback(
    (modeName: ModeType) => {
      updateTheme({ ...theme, mode: modeName });
    },
    [theme, updateTheme]
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl">Customizer</h3>
        <p className="text-sm text-muted-foreground">
          Pick a style and color for the dashboard.
        </p>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm">Color</p>
        <div className="grid grid-cols-3 gap-2">
          {baseColors.map((color) => {
            const isActive = theme.theme === color.name;

            return (
              <Button
                key={color.name}
                variant={isActive ? "secondary" : "default"}
                style={
                  {
                    "--primary":
                      themes[color.name].activeColor[
                        theme.mode === "dark" ? "dark" : "light"
                      ],
                    "--primary-foreground":
                      themes[color.name].activeColor["foreground"],
                  } as React.CSSProperties
                }
                onClick={() => {
                  updateTheme({
                    ...theme,
                    theme: color.name,
                  });
                }}
              >
                <span>{themes[color.name].label}</span>
              </Button>
            );
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm">Radius</p>
        <div className="grid grid-cols-5 gap-2">
          {radiusSizes.map((value) => {
            return (
              <Button
                variant={
                  theme.radius === parseFloat(value) ? "secondary" : "outline"
                }
                key={value}
                onClick={() => {
                  updateTheme({
                    ...theme,
                    radius: parseFloat(value),
                  });
                }}
              >
                {value}
              </Button>
            );
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm">Mode</p>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={theme.mode === "light" ? "secondary" : "outline"}
            onClick={() => setMode("light")}
          >
            <Sun className="size-4 me-1 -translate-x-1" />
            Light
          </Button>
          <Button
            variant={theme.mode === "dark" ? "secondary" : "outline"}
            onClick={() => setMode("dark")}
          >
            <MoonStar className="size-4 me-1 -translate-x-1" />
            Dark
          </Button>
          <Button
            variant={theme.mode === "system" ? "secondary" : "outline"}
            onClick={() => setMode("system")}
          >
            <SunMoon className="size-4 me-1 -translate-x-1" />
            System
          </Button>
        </div>
      </div>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          setMode("system");
          resetTheme();
        }}
      >
        <RotateCcw className="size-4 me-1 -translate-x-1" />
        Reset
      </Button>
    </div>
  );
}
