"use client"

import { useCallback } from "react"
import { MoonStar, RotateCcw, Sun, SunMoon } from "lucide-react"

import type { ModeType, ThemeType } from "@/types"
import type { CSSProperties } from "react"

import { radii, themes } from "@/configs/themes"

import { useSettings } from "@/hooks/use-settings"
import { Button } from "@/components/ui/button"

export function ThemeCustomizer() {
  const { settings, updateSettings, resetSettings } = useSettings()

  const setMode = useCallback(
    (modeName: ModeType) => {
      updateSettings({ ...settings, mode: modeName })
    },
    [settings, updateSettings]
  )

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
          {Object.entries(themes).map(([name, value]) => {
            const isActive = settings.theme === name

            return (
              <Button
                key={name}
                variant={isActive ? "secondary" : "default"}
                style={
                  {
                    "--primary":
                      value.activeColor[
                        settings.mode === "dark" ? "dark" : "light"
                      ],
                    "--primary-foreground": value.activeColor["foreground"],
                  } as CSSProperties
                }
                onClick={() =>
                  updateSettings({
                    ...settings,
                    theme: name as ThemeType,
                  })
                }
              >
                <span>{value.label}</span>
              </Button>
            )
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm">Radius</p>
        <div className="grid grid-cols-5 gap-2">
          {radii.map((value) => {
            return (
              <Button
                variant={settings.radius === value ? "secondary" : "outline"}
                key={value}
                onClick={() => {
                  updateSettings({
                    ...settings,
                    radius: value,
                  })
                }}
              >
                {value}
              </Button>
            )
          })}
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm">Mode</p>
        <div className="grid grid-cols-3 gap-2">
          <Button
            variant={settings.mode === "light" ? "secondary" : "outline"}
            onClick={() => setMode("light")}
          >
            <Sun className="size-4 me-1 -translate-x-1" />
            Light
          </Button>
          <Button
            variant={settings.mode === "dark" ? "secondary" : "outline"}
            onClick={() => setMode("dark")}
          >
            <MoonStar className="size-4 me-1 -translate-x-1" />
            Dark
          </Button>
          <Button
            variant={settings.mode === "system" ? "secondary" : "outline"}
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
          setMode("system")
          resetSettings()
        }}
      >
        <RotateCcw className="size-4 me-1 -translate-x-1" />
        Reset
      </Button>
    </div>
  )
}
