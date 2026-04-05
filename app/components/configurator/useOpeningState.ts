"use client";

import { useCallback, useRef, useState } from "react";
import type { WallOpening } from "../../lib/configurator";
import type { LayoutLike } from "../../lib/configuratorScene/constants";

export function useOpeningState({
  layout,
  wallHeight,
  newOpeningWidthDm,
  newOpeningHeightDm,
}: {
  layout: LayoutLike;
  wallHeight: number;
  newOpeningWidthDm: number;
  newOpeningHeightDm: number;
}) {
  const [wallOpenings, setWallOpenings] = useState<
    Record<string, WallOpening[]>
  >({});
  const [selectedOpeningId, setSelectedOpeningId] = useState<string | null>(
    null,
  );
  const openingIdCounter = useRef(0);

  const handleOpeningAdd = useCallback(
    (wallId: string, x: number, y: number) => {
      const openingWidth = newOpeningWidthDm * 100;
      const openingHeight = newOpeningHeightDm * 100;
      const wall = layout.walls.find((candidate) => candidate.id === wallId);
      if (!wall) return;

      const left = Math.max(
        0,
        Math.min(x - openingWidth / 2, wall.effectiveLength - openingWidth),
      );
      const bottom = Math.max(
        0,
        Math.min(y - openingHeight / 2, wallHeight - openingHeight),
      );
      const id = `op-${++openingIdCounter.current}`;

      setWallOpenings((previous) => ({
        ...previous,
        [wallId]: [
          ...(previous[wallId] || []),
          { id, left, bottom, width: openingWidth, height: openingHeight },
        ],
      }));
      setSelectedOpeningId(id);
    },
    [newOpeningWidthDm, newOpeningHeightDm, layout.walls, wallHeight],
  );

  const handleOpeningDrag = useCallback(
    (openingId: string, left: number, bottom: number) => {
      setWallOpenings((previous) => {
        const next = { ...previous };

        for (const wallId of Object.keys(next)) {
          next[wallId] = next[wallId].map((opening) =>
            opening.id === openingId ? { ...opening, left, bottom } : opening,
          );
        }

        return next;
      });
    },
    [],
  );

  const handleOpeningSelect = useCallback((id: string | null) => {
    setSelectedOpeningId(id);
  }, []);

  const handleOpeningRemove = useCallback(() => {
    if (!selectedOpeningId) return;

    setWallOpenings((previous) => {
      const next = { ...previous };

      for (const wallId of Object.keys(next)) {
        next[wallId] = next[wallId].filter(
          (opening) => opening.id !== selectedOpeningId,
        );
        if (next[wallId].length === 0) delete next[wallId];
      }

      return next;
    });
    setSelectedOpeningId(null);
  }, [selectedOpeningId]);

  return {
    wallOpenings,
    selectedOpeningId,
    handleOpeningAdd,
    handleOpeningDrag,
    handleOpeningSelect,
    handleOpeningRemove,
  };
}
