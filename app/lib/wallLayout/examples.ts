// ============================================================
// Wall Layout System — Usage Examples
//
// All dimensions in millimeters.
// Run: npx tsx app/lib/wallLayout/examples.ts
// ============================================================

import { fromPoints, traceLayout, rectangleLayout } from "./builder";
import { radToDeg } from "./geometry";
import type { Wall } from "./types";

// Helper to print a wall summary
function printWall(w: Wall) {
  console.log(
    `  ${w.id}:  ` +
      `start=(${w.start.x.toFixed(0)}, ${w.start.y.toFixed(0)})  ` +
      `end=(${w.end.x.toFixed(0)}, ${w.end.y.toFixed(0)})  ` +
      `angle=${radToDeg(w.angle).toFixed(1)}°`,
  );
  console.log(
    `         centerline=${w.centerlineLength.toFixed(0)}mm  ` +
      `effective=${w.effectiveLength.toFixed(0)}mm  ` +
      `thickness=${w.thickness}mm`,
  );
  console.log(
    `         startJoint=${w.startCorner.joint} (retraction=${w.startCorner.retraction.toFixed(1)}mm)  ` +
      `endJoint=${w.endCorner.joint} (retraction=${w.endCorner.retraction.toFixed(1)}mm)`,
  );
  console.log(
    `         studs=${w.studLayout.studs.length}  ` +
      `c/c=${w.studLayout.actualSpacing.toFixed(1)}mm  ` +
      `(target=${w.studLayout.targetSpacing}mm)`,
  );
  console.log(
    `         quad: outer=[` +
      `(${w.quad.outerStart.x.toFixed(0)},${w.quad.outerStart.y.toFixed(0)}) → ` +
      `(${w.quad.outerEnd.x.toFixed(0)},${w.quad.outerEnd.y.toFixed(0)})]  ` +
      `inner=[(${w.quad.innerStart.x.toFixed(0)},${w.quad.innerStart.y.toFixed(0)}) → ` +
      `(${w.quad.innerEnd.x.toFixed(0)},${w.quad.innerEnd.y.toFixed(0)})]`,
  );
}

// =========================================================
// EXAMPLE 1: Simple Rectangle (10m × 8m)
// =========================================================
//
// The simplest way to define a building. All you need is
// width and depth. Walls are automatically created with
// alternating through/butt joints (walls 0,2 = through;
// walls 1,3 = butt).
//
//    3 ←←←←←←←←←←←← 2
//    ↓                ↑
//    ↓   (interior)   ↑
//    ↓                ↑
//    0 →→→→→→→→→→→→→ 1
//
console.log("═══════════════════════════════════════════");
console.log("EXAMPLE 1: Rectangle 10m × 8m");
console.log("═══════════════════════════════════════════\n");

const rect = rectangleLayout(10_000, 8_000, { thickness: 145 });

console.log(rect.summary());
console.log("\nDetailed walls:\n");
rect.forEach((w) => {
  printWall(w);
  console.log();
});

// Verify: through walls (0, 2) should have full 10000mm centerline
//         butt walls (1, 3) should have effective = 8000 - 2×145 = 7710mm
console.log("Verification:");
console.log(
  `  Wall 0 (through): effective=${rect.wall(0).effectiveLength}mm (expect 10000)`,
);
console.log(
  `  Wall 1 (butt):    effective=${rect.wall(1).effectiveLength}mm (expect 7710)`,
);
console.log(
  `  Wall 2 (through): effective=${rect.wall(2).effectiveLength}mm (expect 10000)`,
);
console.log(
  `  Wall 3 (butt):    effective=${rect.wall(3).effectiveLength}mm (expect 7710)`,
);

// =========================================================
// EXAMPLE 2: Rectangle via fromPoints
// =========================================================
//
// Same result as above, but defined with explicit corner
// coordinates. Useful when you have surveyed coordinates
// or want non-origin placement.
//
console.log("\n\n═══════════════════════════════════════════");
console.log("EXAMPLE 2: Rectangle via fromPoints");
console.log("═══════════════════════════════════════════\n");

const rect2 = fromPoints(
  [
    [0, 0],
    [10_000, 0],
    [10_000, 8_000],
    [0, 8_000],
  ],
  { thickness: 145 },
);

console.log(rect2.summary());

// =========================================================
// EXAMPLE 3: Rectangle via traceLayout (turtle-graphics)
// =========================================================
//
// Define the same rectangle by walking the perimeter:
// start at origin heading east, turn left at each corner.
//
console.log("\n\n═══════════════════════════════════════════");
console.log("EXAMPLE 3: Rectangle via traceLayout");
console.log("═══════════════════════════════════════════\n");

const rect3 = traceLayout({ thickness: 145 })
  .wall(10_000) // east
  .turn(90) // turn left → now heading north
  .wall(8_000) // north
  .turn(90) // turn left → now heading west
  .wall(10_000) // west
  .close(); // auto-close south back to origin

console.log(rect3.summary());

// =========================================================
// EXAMPLE 4: L-Shaped House
// =========================================================
//
// An L-shape has a reflex corner (interior angle = 270°).
// The trace builder handles this naturally with a negative
// turn angle.
//
//    ┌──────────┐
//    │          │
//    │     ┌────┘
//    │     │
//    └─────┘
//
//  Going CCW from bottom-left:
//    east → north → east → north → west → south (close)
//
console.log("\n\n═══════════════════════════════════════════");
console.log("EXAMPLE 4: L-Shaped House");
console.log("═══════════════════════════════════════════\n");

const lShape = fromPoints(
  [
    [0, 0], // bottom-left
    [6_000, 0], // bottom-right of lower section
    [6_000, 4_000], // inner corner of L (reflex)
    [10_000, 4_000], // bottom-right of upper section
    [10_000, 8_000], // top-right
    [0, 8_000], // top-left
  ],
  { thickness: 145 },
);

console.log(lShape.summary());
console.log("\nDetailed walls:\n");
lShape.forEach((w) => {
  printWall(w);
  console.log();
});

// =========================================================
// EXAMPLE 5: L-Shaped House via Trace
// =========================================================
//
// The same L-shape built with the trace builder.
// Note the turn(-90) for the reflex (right-turn) corner.
//
console.log("\n\n═══════════════════════════════════════════");
console.log("EXAMPLE 5: L-Shaped House via trace");
console.log("═══════════════════════════════════════════\n");

const lTrace = traceLayout({ thickness: 145 })
  .wall(6_000) // east (bottom edge)
  .turn(90) // left → north
  .wall(4_000) // north (right side of lower section)
  .turn(-90) // RIGHT turn → east (reflex corner!)
  .wall(4_000) // east (step in the L)
  .turn(90) // left → north
  .wall(4_000) // north (right side of upper section)
  .turn(90) // left → west
  .wall(10_000) // west (top edge)
  .close(); // auto-close south (left side)

console.log(lTrace.summary());

// =========================================================
// EXAMPLE 6: Angled House (Trapezoid)
// =========================================================
//
// A house with non-90° corners. The front is 12m wide,
// but the back is only 8m, creating angled side walls.
//
//       ┌────────┐       (8m back)
//      ╱          ╲
//     ╱            ╲
//    └──────────────┘    (12m front)
//
console.log("\n\n═══════════════════════════════════════════");
console.log("EXAMPLE 6: Trapezoid House");
console.log("═══════════════════════════════════════════\n");

const trapezoid = fromPoints(
  [
    [0, 0], // front-left
    [12_000, 0], // front-right
    [10_000, 8_000], // back-right (inset by 2m)
    [2_000, 8_000], // back-left (inset by 2m)
  ],
  { thickness: 145 },
);

console.log(trapezoid.summary());
console.log("\nDetailed walls:\n");
trapezoid.forEach((w) => {
  printWall(w);
  console.log();
});

// =========================================================
// EXAMPLE 7: Dynamic Recalculation
// =========================================================
//
// Show how changing parameters produces a new layout.
// The original is never mutated.
//
console.log("\n\n═══════════════════════════════════════════");
console.log("EXAMPLE 7: Dynamic Recalculation");
console.log("═══════════════════════════════════════════\n");

console.log("Original (145mm walls, 600mm stud spacing):");
console.log(
  `  Wall 0: effective=${rect.wall(0).effectiveLength}mm, studs=${rect.wall(0).studLayout.studs.length}`,
);
console.log(
  `  Wall 1: effective=${rect.wall(1).effectiveLength}mm, studs=${rect.wall(1).studLayout.studs.length}`,
);

const thicker = rect.withThickness(195);
console.log("\nAfter changing thickness to 195mm:");
console.log(
  `  Wall 0: effective=${thicker.wall(0).effectiveLength}mm, studs=${thicker.wall(0).studLayout.studs.length}`,
);
console.log(
  `  Wall 1: effective=${thicker.wall(1).effectiveLength}mm (expect 8000 - 2×195 = 7610), studs=${thicker.wall(1).studLayout.studs.length}`,
);

const tighterStuds = rect.withStudSpacing(400);
console.log("\nAfter changing stud spacing to 400mm:");
console.log(
  `  Wall 0: studs=${tighterStuds.wall(0).studLayout.studs.length}, c/c=${tighterStuds.wall(0).studLayout.actualSpacing.toFixed(1)}mm`,
);
console.log(
  `  Wall 1: studs=${tighterStuds.wall(1).studLayout.studs.length}, c/c=${tighterStuds.wall(1).studLayout.actualSpacing.toFixed(1)}mm`,
);

const moved = rect.withCornerMoved(1, { x: 11_000, y: 0 });
console.log(
  "\nAfter moving corner 1 (bottom-right) from (10000,0) to (11000,0):",
);
console.log(
  "  (Note: CW normalisation reverses point order, so wall indices shift)",
);
console.log(
  `  Wall 2 (bottom): centerline=${moved.wall(2).centerlineLength}mm (expect 11000)`,
);
console.log(
  `  Wall 1 (right):  centerline=${moved.wall(1).centerlineLength.toFixed(1)}mm (diagonal, expect ~8062)`,
);

// =========================================================
// EXAMPLE 8: Iterating / Traversal
// =========================================================
console.log("\n\n═══════════════════════════════════════════");
console.log("EXAMPLE 8: Perimeter Traversal");
console.log("═══════════════════════════════════════════\n");

console.log("Walking the perimeter of the rectangle:");
for (const wall of rect) {
  const prev = rect.wall(wall.prevIndex);
  const next = rect.wall(wall.nextIndex);
  console.log(
    `  ${wall.id} → connects: prev=${prev.id}, next=${next.id}, ` +
      `angle=${radToDeg(wall.angle).toFixed(1)}°`,
  );
}

console.log(
  "\nTotal perimeter (outer):",
  rect.map((w) => w.centerlineLength).reduce((a, b) => a + b, 0) + "mm",
);
console.log(
  "Total effective wall length:",
  rect.map((w) => w.effectiveLength).reduce((a, b) => a + b, 0) + "mm",
);
console.log(
  "Total studs:",
  rect.map((w) => w.studLayout.studs.length).reduce((a, b) => a + b, 0),
);

console.log("\n✓ All examples complete.");
