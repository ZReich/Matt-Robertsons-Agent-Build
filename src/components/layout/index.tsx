"use client";

import React from "react";

import { useSettings } from "@/hooks/use-settings";

import type { DictionaryType } from "@/lib/getDictionary";

import VerticalLayout from "./vertical-layout";
import HorizontalLayout from "./horizontal-layout";
import { Customizer } from "./customizer";

function Layout({
  children,
  dictionary,
}: {
  children: React.ReactNode;
  dictionary: DictionaryType;
}) {
  const { settings } = useSettings();
  const isVertical = settings.layout === "vertical";

  return (
    <>
      <Customizer />
      {isVertical ? (
        <VerticalLayout dictionary={dictionary}>{children}</VerticalLayout>
      ) : (
        <HorizontalLayout dictionary={dictionary}>{children}</HorizontalLayout>
      )}
    </>
  );
}

export default Layout;
