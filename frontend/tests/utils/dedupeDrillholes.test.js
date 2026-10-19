import { describe, expect, it } from "vitest";
import { dedupeDrillholes } from "../../src/utils/dedupeDrillholes.js";

const hole = (overrides) => ({ holeId: "H-1", x: 418000, y: 4894000, ...overrides });

describe("dedupeDrillholes", () => {
  it("leaves distinct holes alone", () => {
    const holes = [hole({}), hole({ holeId: "H-2", x: 418500 })];

    expect(dedupeDrillholes(holes)).toHaveLength(2);
  });

  it("collapses two records for the same hole at the same coordinates", () => {
    expect(dedupeDrillholes([hole({}), hole({})])).toHaveLength(1);
  });

  // The reported symptom: a rig drawn with a square underneath it. A marker
  // renders one or the other, so two records for one hole are the only way to
  // get both.
  it("keeps the INPROGRESS copy so the rig wins", () => {
    const collapsed = dedupeDrillholes([
      hole({ holeStatus: "VALIDATED" }),
      hole({ holeStatus: "INPROGRESS" }),
    ]);

    expect(collapsed).toHaveLength(1);
    expect(collapsed[0].holeStatus).toBe("INPROGRESS");
  });

  it("keeps the INPROGRESS copy regardless of which came first", () => {
    const collapsed = dedupeDrillholes([
      hole({ holeStatus: "INPROGRESS" }),
      hole({ holeStatus: "VALIDATED" }),
    ]);

    expect(collapsed[0].holeStatus).toBe("INPROGRESS");
  });

  it("matches the status case-insensitively and across field casings", () => {
    expect(dedupeDrillholes([
      hole({ holeStatus: "VALIDATED" }),
      hole({ HoleStatus: " inprogress " }),
    ])[0].HoleStatus).toBe(" inprogress ");
  });

  // Hole_ID is only unique within a PROJECTCODE and the API does not return
  // the project, so two projects sharing a HOLEID must both survive.
  it("keeps same-id holes that sit at different coordinates", () => {
    const holes = [hole({}), hole({ x: 419000, y: 4895000 })];

    expect(dedupeDrillholes(holes)).toHaveLength(2);
  });

  it("treats coordinates in either field casing as the same hole", () => {
    const holes = [
      { holeId: "H-1", x: 418000, y: 4894000 },
      { holeId: "H-1", X: 418000, Y: 4894000 },
    ];

    expect(dedupeDrillholes(holes)).toHaveLength(1);
  });

  it("ignores hole id casing and padding", () => {
    const holes = [hole({ holeId: "h-1" }), hole({ holeId: " H-1 " })];

    expect(dedupeDrillholes(holes)).toHaveLength(1);
  });

  it("keeps records that have no hole id rather than merging them", () => {
    const holes = [
      { x: 418000, y: 4894000 },
      { x: 418000, y: 4894000 },
    ];

    expect(dedupeDrillholes(holes)).toHaveLength(2);
  });

  it("preserves the original order", () => {
    const holes = [
      hole({ holeId: "C" }),
      hole({ holeId: "A" }),
      hole({ holeId: "B" }),
      hole({ holeId: "A" }),
    ];

    expect(dedupeDrillholes(holes).map((item) => item.holeId))
      .toEqual(["C", "A", "B"]);
  });

  it("returns an empty array for a non-array input", () => {
    expect(dedupeDrillholes(undefined)).toEqual([]);
    expect(dedupeDrillholes(null)).toEqual([]);
  });
});
