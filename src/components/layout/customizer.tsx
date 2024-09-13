"use client";

import React from "react";
import { useTheme } from "next-themes";
import {
  Sun,
  MoonStar,
  Check,
  X,
  RotateCcw,
  Settings,
  AlignStartHorizontal,
  AlignStartVertical,
} from "lucide-react";

import { baseColors } from "@/configs/base-colors";

import { cn } from "@/lib/utils";

import { useSettings } from "@/hooks/use-settings";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetClose,
  SheetPortal,
  SheetTrigger,
  sheetVariants,
} from "@/components/ui/sheet";
import { Content as SheetContent } from "@radix-ui/react-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

export function Customizer() {
  const { resolvedTheme, setTheme } = useTheme();
  const { settings, updateSettings, resetSettings } = useSettings();

  return (
    <Sheet>
      <SheetTrigger className="fixed bottom-10 end-0 z-50" asChild>
        <Button size="icon" className="rounded-e-none">
          <Settings className="size-4" />
          <span className="sr-only">Config settings</span>
        </Button>
      </SheetTrigger>
      <SheetPortal>
        <SheetContent
          className={cn(sheetVariants({ side: "oppositeDir" }), "px-0")}
        >
          <ScrollArea className="h-full px-6">
            <SheetClose className="absolute end-4 top-4 me-6 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
              <X className="size-4" />
              <span className="sr-only">Close</span>
            </SheetClose>
            <div className="flex flex-1 flex-col space-y-4">
              <div className="space-y-1">
                <div className="font-semibold leading-none tracking-tight">
                  Customize
                </div>
                <div className="text-xs text-muted-foreground">
                  Pick a style and color for the dashboard.
                </div>
              </div>
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
                          "justify-start",
                          isActive && "border-2 border-primary"
                        )}
                        style={
                          {
                            "--theme-primary": `hsl(${
                              theme?.activeColor[
                                resolvedTheme === "dark" ? "dark" : "light"
                              ]
                            })`,
                          } as React.CSSProperties
                        }
                      >
                        <span
                          className={cn(
                            "me-1 flex h-5 w-5 shrink-0 -translate-x-1 items-center justify-center rounded-full bg-[--theme-primary]"
                          )}
                        >
                          {isActive && (
                            <Check className="h-4 w-4 text-primary-foreground" />
                          )}
                        </span>
                        {theme.label}
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
                    onClick={() => setTheme("light")}
                    className={cn(
                      resolvedTheme === "light" && "border-2 border-primary"
                    )}
                  >
                    <Sun className="size-4 me-1 -translate-x-1" />
                    Light
                  </Button>
                  <Button
                    variant={"outline"}
                    size="sm"
                    onClick={() => setTheme("dark")}
                    className={cn(
                      resolvedTheme === "dark" && "border-2 border-primary"
                    )}
                  >
                    <MoonStar className="size-4 me-1 -translate-x-1" />
                    Dark
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
                  setTheme("system");
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
