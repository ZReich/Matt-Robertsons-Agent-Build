"use client";

import * as React from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LineCharts } from "./line-charts";
import { AreaCharts } from "./area-charts";
import { BarCharts } from "./bar-charts";
import { ComposedCharts } from "./composed-charts";
import { PieCharts } from "./pie-charts";
import { RadarCharts } from "./radar-charts";
import { RadialBarCharts } from "./radial-bar-charts";
import { ScatterCharts } from "./scatter-charts";
import { TreemapCharts } from "./treemap";

export function Charts() {
  const [activeTab, setActiveTab] = React.useState("line");

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="container text-center p-4"
    >
      <TabsList className="h-auto mb-2">
        <TabsTrigger value="line">Line</TabsTrigger>
        <TabsTrigger value="area">Area</TabsTrigger>
        <TabsTrigger value="bar">Bar</TabsTrigger>
        <TabsTrigger value="composed">Composed</TabsTrigger>
        <TabsTrigger value="pie">Pie</TabsTrigger>
        <TabsTrigger value="radar">Radar</TabsTrigger>
        <TabsTrigger value="radialbar">Radial Bar</TabsTrigger>
        <TabsTrigger value="scatter">Scatter</TabsTrigger>
        <TabsTrigger value="treemap">Treemap</TabsTrigger>
      </TabsList>
      <TabsContent value="line">
        <LineCharts />
      </TabsContent>
      <TabsContent value="area">
        <AreaCharts />
      </TabsContent>
      <TabsContent value="bar">
        <BarCharts />
      </TabsContent>
      <TabsContent value="composed">
        <ComposedCharts />
      </TabsContent>
      <TabsContent value="pie">
        <PieCharts />
      </TabsContent>
      <TabsContent value="radar">
        <RadarCharts />
      </TabsContent>
      <TabsContent value="radialbar">
        <RadialBarCharts />
      </TabsContent>
      <TabsContent value="scatter">
        <ScatterCharts />
      </TabsContent>
      <TabsContent value="treemap">
        <TreemapCharts />
      </TabsContent>
    </Tabs>
  );
}
