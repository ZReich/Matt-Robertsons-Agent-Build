import { describe, expect, it } from "vitest"

import {
  mapBuildoutStageToDealStage,
  parseBuildoutStageTransition,
} from "./buildout-stage-parser"

describe("parseBuildoutStageTransition", () => {
  it("extracts from/to stage from typical body", () => {
    const result = parseBuildoutStageTransition(
      "Alpenglow Healthcare LLC Lease was updated from Transacting to Closed"
    )
    expect(result).toEqual({
      fromStageRaw: "Transacting",
      toStageRaw: "Closed",
    })
  })

  it("returns null when body lacks the pattern", () => {
    expect(parseBuildoutStageTransition("Some other content")).toBeNull()
  })
})

describe("mapBuildoutStageToDealStage", () => {
  it("maps Transacting → under_contract", () => {
    expect(mapBuildoutStageToDealStage("Transacting")).toEqual("under_contract")
  })
  it("maps Closed → closed", () => {
    expect(mapBuildoutStageToDealStage("Closed")).toEqual("closed")
  })
  it("maps Marketing → marketing", () => {
    expect(mapBuildoutStageToDealStage("Marketing")).toEqual("marketing")
  })
  it("returns null for unknown stages", () => {
    expect(mapBuildoutStageToDealStage("Frobnicating")).toBeNull()
  })
})
