"use client";

import type { FlowDocument } from "@/lib/drawflow";

// draw_flow 순서도를 그림(SVG)으로 그립니다. 도형 위치·크기와 화살표 경로는 draw_flow 가 정한 값 그대로.
// 글자는 SVG <text> 로만 넣어 HTML 로 해석되지 않습니다.

type Side = "t" | "r" | "b" | "l";
type Pt = { x: number; y: number };

const COLORS = {
  terminalFill: "#e0f2fe",
  terminalStroke: "#0369a1",
  processFill: "#ffffff",
  processStroke: "#334155",
  decisionFill: "#fef3c7",
  decisionStroke: "#b45309",
  edge: "#334155",
  yes: "#15803d",
  no: "#b91c1c",
};
const PAD = 24;
const OFFSET = 18; // 화살표가 도형에서 나와 꺾이기 전 길이

function anchor(n: FlowDocument["nodes"][number], side: string): Pt {
  switch (side as Side) {
    case "t":
      return { x: n.x + n.width / 2, y: n.y };
    case "b":
      return { x: n.x + n.width / 2, y: n.y + n.height };
    case "l":
      return { x: n.x, y: n.y + n.height / 2 };
    default:
      return { x: n.x + n.width, y: n.y + n.height / 2 };
  }
}

function step(p: Pt, side: string, d: number): Pt {
  if (side === "t") return { x: p.x, y: p.y - d };
  if (side === "b") return { x: p.x, y: p.y + d };
  if (side === "l") return { x: p.x - d, y: p.y };
  return { x: p.x + d, y: p.y };
}

/** 경로가 없으면(편집기에서 도형을 옮긴 경우) 직각 꺾은선으로 잇습니다 */
function elbow(s: Pt, sSide: string, t: Pt, tSide: string): Pt[] {
  const a = step(s, sSide, OFFSET);
  const b = step(t, tSide, OFFSET);
  const vertical = sSide === "t" || sSide === "b";
  const mid = vertical
    ? [
        { x: a.x, y: (a.y + b.y) / 2 },
        { x: b.x, y: (a.y + b.y) / 2 },
      ]
    : [
        { x: (a.x + b.x) / 2, y: a.y },
        { x: (a.x + b.x) / 2, y: b.y },
      ];
  return [s, a, ...mid, b, t];
}

export function FlowChart({ doc, maxHeight = 520 }: { doc: FlowDocument; maxHeight?: number }) {
  const byId = new Map(doc.nodes.map((n) => [n.id, n]));
  const edges = doc.edges.flatMap((e) => {
    const s = byId.get(e.source);
    const t = byId.get(e.target);
    if (!s || !t) return [];
    const pts =
      e.points && e.points.length >= 2
        ? e.points
        : elbow(anchor(s, e.sourceHandle), e.sourceHandle, anchor(t, e.targetHandle), e.targetHandle);
    return [{ ...e, pts }];
  });

  if (!doc.nodes.length) return null;
  const xs = [...doc.nodes.flatMap((n) => [n.x, n.x + n.width]), ...edges.flatMap((e) => e.pts.map((p) => p.x))];
  const ys = [...doc.nodes.flatMap((n) => [n.y, n.y + n.height]), ...edges.flatMap((e) => e.pts.map((p) => p.y))];
  const minX = Math.min(...xs) - PAD;
  const minY = Math.min(...ys) - PAD;
  const w = Math.max(...xs) - minX + PAD;
  const h = Math.max(...ys) - minY + PAD;

  return (
    <div className="overflow-auto rounded-lg border border-line bg-white" style={{ maxHeight }}>
      <svg
        viewBox={`${minX} ${minY} ${w} ${h}`}
        width={w}
        style={{
          maxWidth: "100%",
          height: "auto",
          display: "block",
          margin: "0 auto",
        }}
        role="img"
        aria-label={`순서도${doc.title ? `: ${doc.title}` : ""} (도형 ${doc.nodes.length}개)`}
        fontFamily="inherit"
      >
        <defs>
          <marker
            id="df-arrow"
            viewBox="0 0 10 10"
            refX="9"
            refY="5"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill={COLORS.edge} />
          </marker>
        </defs>
        {edges.map((e) => {
          const d = e.pts.map((p, i) => `${i ? "L" : "M"}${p.x},${p.y}`).join(" ");
          const s = e.pts[0];
          const side = e.sourceHandle;
          const lx = s.x + (side === "r" ? 8 : side === "l" ? -8 : 6);
          const ly = s.y + (side === "b" ? 18 : side === "t" ? -8 : -6);
          return (
            <g key={e.id}>
              <path d={d} fill="none" stroke={COLORS.edge} strokeWidth={2} markerEnd="url(#df-arrow)" />
              {e.label && (
                <text
                  x={lx}
                  y={ly}
                  fontSize={13}
                  fontWeight={700}
                  textAnchor={side === "l" ? "end" : "start"}
                  fill={e.label === "예" ? COLORS.yes : COLORS.no}
                >
                  {e.label}
                </text>
              )}
            </g>
          );
        })}
        {doc.nodes.map((n) => {
          const cx = n.x + n.width / 2;
          const cy = n.y + n.height / 2;
          return (
            <g key={n.id}>
              {n.kind === "decision" ? (
                <polygon
                  points={`${cx},${n.y} ${n.x + n.width},${cy} ${cx},${n.y + n.height} ${n.x},${cy}`}
                  fill={COLORS.decisionFill}
                  stroke={COLORS.decisionStroke}
                  strokeWidth={2}
                />
              ) : (
                <rect
                  x={n.x}
                  y={n.y}
                  width={n.width}
                  height={n.height}
                  rx={n.kind === "terminal" ? n.height / 2 : 0}
                  fill={n.kind === "terminal" ? COLORS.terminalFill : COLORS.processFill}
                  stroke={n.kind === "terminal" ? COLORS.terminalStroke : COLORS.processStroke}
                  strokeWidth={2}
                />
              )}
              <text
                x={cx}
                y={cy}
                fontSize={14}
                fontWeight={n.kind === "terminal" ? 700 : 400}
                textAnchor="middle"
                dominantBaseline="central"
                fill="#0f172a"
              >
                {n.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
