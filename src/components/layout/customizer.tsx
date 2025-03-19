"use client"

import { useCallback } from "react"
import { useParams, usePathname, useRouter } from "next/navigation"
import {
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  MoonStar,
  RotateCcw,
  Settings,
  Sun,
  SunMoon,
} from "lucide-react"

import type { LocaleType, ModeType } from "@/types"
import type { CSSProperties } from "react"

import { baseColors } from "@/configs/base-colors"
import { i18n } from "@/configs/i18n"
import { relocalizePathname } from "@/lib/i18n"

import { useSettings } from "@/hooks/use-settings"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"

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
}

const radiusSizes = ["0", "0.3", "0.5", "0.75", "1.0"]

export function Customizer() {
  const { settings, updateSettings, resetSettings } = useSettings()
  const pathname = usePathname()
  const router = useRouter()
  const params = useParams()

  const locale = params.lang as LocaleType
  const direction = i18n.localeDirection[locale]

  const handleSetLocale = useCallback(
    (localeName: LocaleType) => {
      updateSettings({ ...settings, locale: localeName })
      router.push(relocalizePathname(pathname, localeName))
    },
    [settings, updateSettings, router, pathname]
  )

  const handleSetMode = useCallback(
    (modeName: ModeType) => {
      updateSettings({ ...settings, mode: modeName })
    },
    [settings, updateSettings]
  )

  const handleReset = useCallback(() => {
    resetSettings()
    router.push(relocalizePathname(pathname, "en"))
  }, [resetSettings, router, pathname])

  return (
    <Sheet>
      <SheetTrigger className="fixed bottom-10 end-0 z-50" asChild>
        <Button size="icon" className="rounded-e-none" aria-label="Customizer">
          <Settings className="shrink-0 h-4 w-4" />
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
                <p className="text-sm">Color</p>
                <div className="grid grid-cols-3 gap-2">
                  {baseColors.map((color) => {
                    const isActive = settings.theme === color.name

                    return (
                      <Button
                        key={color.name}
                        variant={isActive ? "secondary" : "default"}
                        style={
                          {
                            "--primary":
                              themes[color.name].activeColor[
                                settings.mode === "dark" ? "dark" : "light"
                              ],
                            "--primary-foreground":
                              themes[color.name].activeColor["foreground"],
                          } as CSSProperties
                        }
                        onClick={() =>
                          updateSettings({
                            ...settings,
                            theme: color.name,
                          })
                        }
                      >
                        <span>{themes[color.name].label}</span>
                      </Button>
                    )
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm">Radius</p>
                <div className="grid grid-cols-5 gap-2">
                  {radiusSizes.map((value) => (
                    <Button
                      variant={
                        settings.radius === parseFloat(value)
                          ? "secondary"
                          : "outline"
                      }
                      key={value}
                      onClick={() => {
                        updateSettings({
                          ...settings,
                          radius: parseFloat(value),
                        })
                      }}
                    >
                      {value}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm">Mode</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={
                      settings.mode === "light" ? "secondary" : "outline"
                    }
                    onClick={() => handleSetMode("light")}
                  >
                    <Sun className="shrink-0 h-4 w-4 me-2" />
                    Light
                  </Button>
                  <Button
                    variant={settings.mode === "dark" ? "secondary" : "outline"}
                    onClick={() => handleSetMode("dark")}
                  >
                    <MoonStar className="shrink-0 h-4 w-4 me-2" />
                    Dark
                  </Button>
                  <Button
                    variant={
                      settings.mode === "system" ? "secondary" : "outline"
                    }
                    onClick={() => handleSetMode("system")}
                  >
                    <SunMoon className="shrink-0 h-4 w-4 me-2" />
                    System
                  </Button>
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm">Layout</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={
                        settings.layout === "horizontal"
                          ? "secondary"
                          : "outline"
                      }
                      onClick={() =>
                        updateSettings({
                          ...settings,
                          layout: "horizontal",
                        })
                      }
                    >
                      <AlignStartHorizontal className="shrink-0 h-4 w-4 me-2" />
                      Horizontal
                    </Button>
                    <Button
                      variant={
                        settings.layout === "vertical" ? "secondary" : "outline"
                      }
                      onClick={() =>
                        updateSettings({
                          ...settings,
                          layout: "vertical",
                        })
                      }
                    >
                      <AlignStartVertical className="shrink-0 h-4 w-4 me-2" />
                      Vertical
                    </Button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <span className="text-sm">Direction</span>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant={direction === "ltr" ? "secondary" : "outline"}
                      onClick={() => handleSetLocale("en")}
                    >
                      <AlignLeft className="shrink-0 h-4 w-4 me-2" />
                      LRT
                    </Button>
                    <Button
                      variant={direction === "rtl" ? "secondary" : "outline"}
                      onClick={() => handleSetLocale("ar")}
                    >
                      <AlignRight className="shrink-0 h-4 w-4 me-2" />
                      RTL
                    </Button>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={handleReset}
              >
                <RotateCcw className="shrink-0 h-4 w-4 me-2" />
                Reset
              </Button>
            </div>
          </ScrollArea>
        </SheetContent>
      </SheetPortal>
    </Sheet>
  )
}
