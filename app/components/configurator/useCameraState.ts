"use client";

import { useCallback, useRef, useState } from "react";
import type { CameraView } from "./types";

export function useCameraState({
  cameraTarget,
}: {
  cameraTarget: [number, number, number];
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null);
  const [cameraView, setCameraView] = useState<CameraView>({
    key: 0,
    position: [15, 10, 15],
    target: [0, 0, 0],
  });

  const handleCenterCamera = useCallback(() => {
    setCameraView((view) => ({
      key: view.key + 1,
      position: [
        cameraTarget[0] + 15,
        cameraTarget[1] + 9,
        cameraTarget[2] + 15,
      ],
      target: cameraTarget,
    }));
  }, [cameraTarget]);

  return {
    controlsRef,
    cameraView,
    handleCenterCamera,
  };
}
