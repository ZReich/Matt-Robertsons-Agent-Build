import { describe, expect, it } from "vitest"

import {
  mapBuildoutStageToDealOutcome,
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
  it("maps Sourcing → prospecting", () => {
    expect(mapBuildoutStageToDealStage("Sourcing")).toEqual("prospecting")
  })
  it("maps Evaluating → prospecting", () => {
    expect(mapBuildoutStageToDealStage("Evaluating")).toEqual("prospecting")
  })
  it("maps Dead → closed (paired with outcome=lost)", () => {
    expect(mapBuildoutStageToDealStage("Dead")).toEqual("closed")
  })
  it("returns null for unknown stages", () => {
    expect(mapBuildoutStageToDealStage("Frobnicating")).toBeNull()
  })
})

describe("mapBuildoutStageToDealOutcome", () => {
  it("Closed → won", () => {
    expect(mapBuildoutStageToDealOutcome("Closed")).toBe("won")
  })
  it("Dead → lost", () => {
    expect(mapBuildoutStageToDealOutcome("Dead")).toBe("lost")
  })
  it("non-terminal stages → null", () => {
    expect(mapBuildoutStageToDealOutcome("Marketing")).toBeNull()
    expect(mapBuildoutStageToDealOutcome("Showings")).toBeNull()
    expect(mapBuildoutStageToDealOutcome("Transacting")).toBeNull()
  })
})
