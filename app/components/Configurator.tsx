"use client";

import React from "react";
import { ConfiguratorSidebar } from "./configurator/ConfiguratorSidebar";
import { ConfiguratorScene } from "./configurator/ConfiguratorScene";
import { ConfiguratorViewport } from "./configurator/ConfiguratorViewport";
import { useConfiguratorState } from "./configurator/useConfiguratorState";

// ---- Main Scene Component ----

export default function Configurator() {
  const { sidebarProps, viewportProps, sceneProps } = useConfiguratorState();

  return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-zinc-900">
      <ConfiguratorSidebar {...sidebarProps} />

      <ConfiguratorViewport {...viewportProps}>
        <ConfiguratorScene {...sceneProps} />
      </ConfiguratorViewport>
    </div>
  );
}
