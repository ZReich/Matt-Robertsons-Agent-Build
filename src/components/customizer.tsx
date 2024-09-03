"use client";

import React from "react";
import { useTheme } from "next-themes";
import { CheckIcon, MoonIcon, Settings } from "lucide-react";
import { Cross2Icon, ResetIcon, SunIcon } from "@radix-ui/react-icons";

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
import { CustomThemeProvider } from "@/providers/custom-theme-provider";

export function Customizer() {
  const { resolvedTheme, setTheme } = useTheme();
  const { settings, updateSettings } = useSettings();

  return (
    <Sheet>
      <SheetTrigger className="fixed bottom-10 end-0" asChild>
        <Button size="icon" className="rounded-e-none">
          <Settings className="size-4 animate-spin" />
          <span className="sr-only">Config settings</span>
        </Button>
      </SheetTrigger>
      <SheetPortal>
        <SheetContent className={cn(sheetVariants({ side: "oppositeDir" }))}>
          <SheetClose className="absolute end-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-secondary">
            <Cross2Icon className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </SheetClose>
          <CustomThemeProvider>
            <div className="flex items-start pt-4 md:pt-0">
              <div className="space-y-1 pr-2">
                <div className="font-semibold leading-none tracking-tight">
                  Customize
                </div>
                <div className="text-xs text-muted-foreground">
                  Pick a style and color for your components.
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="ml-auto rounded-[0.5rem]"
                onClick={() => {
                  updateSettings({
                    ...settings,
                    theme: "zinc",
                    radius: 0.5,
                  });
                }}
              >
                <ResetIcon />
                <span className="sr-only">Reset</span>
              </Button>
            </div>
            <div className="flex flex-1 flex-col space-y-4 md:space-y-6">
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
                            "mr-1 flex h-5 w-5 shrink-0 -translate-x-1 items-center justify-center rounded-full bg-[--theme-primary]"
                          )}
                        >
                          {isActive && (
                            <CheckIcon className="h-4 w-4 text-white" />
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
                      resolvedTheme === "light" && "border-2 border-raduis"
                    )}
                  >
                    <SunIcon className="mr-1 -translate-x-1" />
                    Light
                  </Button>
                  <Button
                    variant={"outline"}
                    size="sm"
                    onClick={() => setTheme("dark")}
                    className={cn(
                      resolvedTheme === "dark" && "border-2 border-raduis"
                    )}
                  >
                    <MoonIcon className="mr-1 -translate-x-1" />
                    Dark
                  </Button>
                </div>
              </div>
            </div>
          </CustomThemeProvider>
        </SheetContent>
      </SheetPortal>
    </Sheet>
  );
}
