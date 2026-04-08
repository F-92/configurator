"use client";

import type { TrussDesignResult } from "../../lib/truss/types";

interface TrussSVGProps {
  result: TrussDesignResult;
}

function utilizationColor(u: number): string {
  if (u <= 0.5) return "#22c55e"; // green
  if (u <= 0.75) return "#eab308"; // yellow
  if (u <= 1.0) return "#f97316"; // orange
  return "#ef4444"; // red
}

export default function TrussSVG({ result }: TrussSVGProps) {
  const { geometry, designChecks } = result;
  const { nodes, members } = geometry;

  // Compute bounding box
  const xs = nodes.map((n) => n.x);
  const ys = nodes.map((n) => n.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const padding = 0.8;
  const svgMinX = minX - padding;
  const svgMaxX = maxX + padding;
  const svgMinY = minY - padding;
  const svgMaxY = maxY + padding;
  const svgW = svgMaxX - svgMinX;
  const svgH = svgMaxY - svgMinY;

  // Flip Y for SVG (SVG y increases downward)
  const toSvgY = (y: number) => svgMaxY - y;

  // Build a lookup from memberId to designCheck
  const checkMap = new Map(designChecks.map((c) => [c.memberId, c]));

  const supportSize = svgH * 0.06;

  return (
    <div className="bg-zinc-900 rounded-lg border border-zinc-700 p-4">
      <svg
        viewBox={`${svgMinX} 0 ${svgW} ${svgH}`}
        className="w-full"
        style={{ maxHeight: 400 }}
      >
        {/* Members */}
        {members.map((m) => {
          const n1 = nodes[m.startNodeId];
          const n2 = nodes[m.endNodeId];
          const check = checkMap.get(m.id);
          const color = check ? utilizationColor(check.utilization) : "#71717a";
          const strokeWidth = m.group === "web" ? 0.04 : 0.06;

          return (
            <g key={m.id}>
              <line
                x1={n1.x}
                y1={toSvgY(n1.y)}
                x2={n2.x}
                y2={toSvgY(n2.y)}
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
              />
              {/* Invisible wider line for hover */}
              <line
                x1={n1.x}
                y1={toSvgY(n1.y)}
                x2={n2.x}
                y2={toSvgY(n2.y)}
                stroke="transparent"
                strokeWidth={0.15}
                strokeLinecap="round"
              >
                <title>
                  {check
                    ? `${m.label}: ${check.axialForce.toFixed(1)} kN (${check.mode})\nUtilization: ${(check.utilization * 100).toFixed(0)}%${check.buckling ? " [buckling]" : ""}\n${check.pass ? "✓ OK" : "✗ FAIL"}`
                    : m.label}
                </title>
              </line>
              {/* Member label */}
              <text
                x={(n1.x + n2.x) / 2}
                y={toSvgY((n1.y + n2.y) / 2) - 0.1}
                textAnchor="middle"
                className="fill-zinc-400"
                fontSize={0.18}
              >
                {m.label}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map((n) => (
          <circle
            key={n.id}
            cx={n.x}
            cy={toSvgY(n.y)}
            r={0.08}
            className="fill-zinc-300"
          >
            <title>{n.label}</title>
          </circle>
        ))}

        {/* Supports */}
        {geometry.supports.map((sup) => {
          const node = nodes[sup.nodeId];
          const cx = node.x;
          const cy = toSvgY(node.y);
          const s = supportSize;

          if (sup.type === "pinned") {
            // Triangle
            return (
              <polygon
                key={`sup-${sup.nodeId}`}
                points={`${cx},${cy} ${cx - s},${cy + s * 1.2} ${cx + s},${cy + s * 1.2}`}
                fill="none"
                stroke="#a1a1aa"
                strokeWidth={0.03}
              />
            );
          } else {
            // Triangle + line (roller)
            return (
              <g key={`sup-${sup.nodeId}`}>
                <polygon
                  points={`${cx},${cy} ${cx - s},${cy + s * 1.2} ${cx + s},${cy + s * 1.2}`}
                  fill="none"
                  stroke="#a1a1aa"
                  strokeWidth={0.03}
                />
                <line
                  x1={cx - s * 1.1}
                  y1={cy + s * 1.35}
                  x2={cx + s * 1.1}
                  y2={cy + s * 1.35}
                  stroke="#a1a1aa"
                  strokeWidth={0.03}
                />
              </g>
            );
          }
        })}

        {/* Dimension line at bottom */}
        <line
          x1={nodes[0].x}
          y1={toSvgY(-0.3)}
          x2={nodes[nodes.length - 3].x}
          y2={toSvgY(-0.3)}
          stroke="#71717a"
          strokeWidth={0.02}
          markerStart="url(#arrowL)"
          markerEnd="url(#arrowR)"
        />
        <text
          x={(nodes[0].x + nodes[nodes.length - 3].x) / 2}
          y={toSvgY(-0.5)}
          textAnchor="middle"
          className="fill-zinc-500"
          fontSize={0.2}
        >
          {(nodes[nodes.length - 3].x - nodes[0].x).toFixed(1)} m
        </text>

        <defs>
          <marker
            id="arrowL"
            markerWidth="6"
            markerHeight="4"
            refX="0"
            refY="2"
            orient="auto"
          >
            <path
              d="M6,0 L0,2 L6,4"
              fill="none"
              stroke="#71717a"
              strokeWidth="0.5"
            />
          </marker>
          <marker
            id="arrowR"
            markerWidth="6"
            markerHeight="4"
            refX="6"
            refY="2"
            orient="auto"
          >
            <path
              d="M0,0 L6,2 L0,4"
              fill="none"
              stroke="#71717a"
              strokeWidth="0.5"
            />
          </marker>
        </defs>
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs text-zinc-400">
        <span className="flex items-center gap-1">
          <span className="w-3 h-1 rounded bg-green-500 inline-block" />
          {"≤50%"}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-1 rounded bg-yellow-500 inline-block" />
          {"≤75%"}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-1 rounded bg-orange-500 inline-block" />
          {"≤100%"}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-1 rounded bg-red-500 inline-block" />
          {">100%"}
        </span>
        <span className="ml-auto text-zinc-500">Hover members for details</span>
      </div>
    </div>
  );
}
