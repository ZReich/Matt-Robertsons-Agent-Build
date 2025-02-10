"use client";

import * as React from "react";
import {
  Sun,
  MoonStar,
  SunMoon,
  Check,
  X,
  RotateCcw,
  Settings,
  AlignStartHorizontal,
  AlignStartVertical,
} from "lucide-react";

import { baseColors } from "@/configs/base-colors";

import { cn } from "@/lib/utils";

import type { ModeType } from "@/types";

import { useSettings } from "@/hooks/use-settings";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";

const themes = {
  zinc: {
    label: "Zinc",
    activeColor: {
      light: "240 5.9% 10%",
      dark: "240 5.2% 33.9%",
    },
  },
  slate: {
    name: "slate",
    label: "Slate",
    activeColor: {
      light: "215.4 16.3% 46.9%",
      dark: "215.3 19.3% 34.5%",
    },
  },
  stone: {
    label: "Stone",
    activeColor: {
      light: "25 5.3% 44.7%",
      dark: "33.3 5.5% 32.4%",
    },
  },
  gray: {
    label: "Gray",
    activeColor: {
      light: "220 8.9% 46.1%",
      dark: "215 13.8% 34.1%",
    },
  },
  neutral: {
    label: "Neutral",
    activeColor: {
      light: "0 0% 45.1%",
      dark: "0 0% 32.2%",
    },
  },
  red: {
    name: "red",
    label: "Red",
    activeColor: {
      light: "0 72.2% 50.6%",
      dark: "0 72.2% 50.6%",
    },
  },
  rose: {
    label: "Rose",
    activeColor: {
      light: "346.8 77.2% 49.8%",
      dark: "346.8 77.2% 49.8%",
    },
  },
  orange: {
    label: "Orange",
    activeColor: {
      light: "24.6 95% 53.1%",
      dark: "20.5 90.2% 48.2%",
    },
  },
  green: {
    label: "Green",
    activeColor: {
      light: "142.1 76.2% 36.3%",
      dark: "142.1 70.6% 45.3%",
    },
  },
  blue: {
    label: "Blue",
    activeColor: {
      light: "221.2 83.2% 53.3%",
      dark: "217.2 91.2% 59.8%",
    },
  },
  yellow: {
    label: "Yellow",
    activeColor: {
      light: "47.9 95.8% 53.1%",
      dark: "47.9 95.8% 53.1%",
    },
  },
  violet: {
    label: "Violet",
    activeColor: {
      light: "262.1 83.3% 57.8%",
      dark: "263.4 70% 50.4%",
    },
  },
};

export function Customizer() {
  const { settings, updateSettings, resetSettings } = useSettings();

  const setMode = React.useCallback(
    (modeName: ModeType) => {
      updateSettings({ ...settings, mode: modeName });
    },
    [settings, updateSettings]
  );

  return (
    <Sheet>
      <SheetTrigger className="fixed bottom-10 end-0 z-50" asChild>
        <Button size="icon" className="rounded-e-none" aria-label="Customizer">
          <Settings className="size-4" />
        </Button>
      </SheetTrigger>
      <SheetPortal>
        <SheetContent className="p-0" side="end">
          <ScrollArea className="h-full p-4">
            <div className="flex flex-1 flex-col space-y-4">
              <SheetHeader>
                <SheetTitle>Customizer</SheetTitle>
                <SheetDescription>
                  Pick a style and color for the dashboard.
                </SheetDescription>
              </SheetHeader>
              <div className="space-y-1.5">
                <span className="text-xs">Color</span>
                <div className="grid grid-cols-3 gap-2">
                  {baseColors.map((theme) => {
                    const isActive = settings.theme === theme.name;

                    return (
                      <Button
                        variant={"outline"}
                        size="sm"
                        key={theme.name}
                        onClick={() => {
                          updateSettings({
                            ...settings,
                            theme: theme.name,
                          });
                        }}
                        className={cn(
                          "justify-start gap-x-2",
                          isActive && "border-2 border-primary"
                        )}
                        style={
                          {
                            "--theme-primary": `hsl(${
                              themes[theme.name].activeColor[
                                settings.mode === "dark" ? "dark" : "light"
                              ]
                            })`,
                          } as React.CSSProperties
                        }
                      >
                        <span
                          className={cn(
                            "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[--theme-primary]"
                          )}
                        >
                          {isActive && (
                            <Check className="h-4 w-4 text-primary-foreground" />
                          )}
                        </span>
                        <span>{themes[theme.name].label}</span>
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs">Radius</span>
                <div className="grid grid-cols-5 gap-2">
                  {["0", "0.3", "0.5", "0.75", "1.0"].map((value) => {
                    return (
                      <Button
                        variant={"outline"}
                        size="sm"
                        key={value}
                        onClick={() => {
                          updateSettings({
                            ...settings,
                            radius: parseFloat(value),
                          });
                        }}
                        className={cn(
                          settings.radius === parseFloat(value) &&
                            "border-2 border-primary"
                        )}
                      >
                        {value}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs">Mode</span>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={"outline"}
                    size="sm"
                    onClick={() => setMode("light")}
                    className={cn(
                      settings.mode === "light" && "border-2 border-primary"
                    )}
                  >
                    <Sun className="size-4 me-1 -translate-x-1" />
                    Light
                  </Button>
                  <Button
                    variant={"outline"}
                    size="sm"
                    onClick={() => setMode("dark")}
                    className={cn(
                      settings.mode === "dark" && "border-2 border-primary"
                    )}
                  >
                    <MoonStar className="size-4 me-1 -translate-x-1" />
                    Dark
                  </Button>
                  <Button
                    variant={"outline"}
                    size="sm"
                    onClick={() => setMode("system")}
                    className={cn(
                      settings.mode === "system" && "border-2 border-primary"
                    )}
                  >
                    <SunMoon className="size-4 me-1 -translate-x-1" />
                    System
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <span className="text-xs">Layout</span>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={"outline"}
                    size="sm"
                    onClick={() => {
                      updateSettings({
                        ...settings,
                        layout: "horizontal",
                      });
                    }}
                    className={cn(
                      settings.layout === "horizontal" &&
                        "border-2 border-primary"
                    )}
                  >
                    <AlignStartHorizontal className="size-4 me-1 -translate-x-1" />
                    Horizontal
                  </Button>
                  <Button
                    variant={"outline"}
                    size="sm"
                    onClick={() => {
                      updateSettings({
                        ...settings,
                        layout: "vertical",
                      });
                    }}
                    className={cn(
                      settings.layout === "vertical" &&
                        "border-2 border-primary"
                    )}
                  >
                    <AlignStartVertical className="size-4 me-1 -translate-x-1" />
                    Vertical
                  </Button>
                </div>
              </div>
              <Button
                variant={"destructive"}
                size="sm"
                onClick={() => {
                  setMode("system");
                  resetSettings();
                }}
              >
                <RotateCcw className="size-4 me-1 -translate-x-1" />
                Reset
              </Button>
            </div>
          </ScrollArea>
        </SheetContent>
      </SheetPortal>
    </Sheet>
  );
}
