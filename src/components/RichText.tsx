"use client";

import { useEffect, useState } from "react";
import { highlight, langLabel, normalizeLang } from "@/lib/code";
import { currentBoardId, decodeDrawFlowLink, drawFlowOpenUrl, encodePayload, type FlowDocument } from "@/lib/drawflow";
import { FlowChart } from "./FlowChart";

// 글 내용 표시 (계획서 2-1).
//  ```python ... ```  → 코드 상자 (문법 색, 줄 번호, 복사 버튼, 가로 스크롤)
//  ```error ... ```   → 빨간 테두리 에러 메시지 상자 (질문 양식)
//  ```drawflow z… ``` → draw_flow 순서도 카드 ([draw_flow에서 열기])
//  `한 줄`            → 인라인 코드
// 일반 글은 HTML 로 해석하지 않고 글자 그대로 보여줘서 안전합니다.

type Segment = { kind: "text"; text: string } | { kind: "code"; lang: string; code: string };

export function parseSegments(src: string): Segment[] {
  const out: Segment[] = [];
  const re = /```([\w+#-]*)[^\S\n]*\n?([\s\S]*?)(?:\n?```|$)/g;
  let last = 0;
  for (let m = re.exec(src); m; m = re.exec(src)) {
    if (m[0].length === 0) break;
    if (m.index > last) out.push({ kind: "text", text: src.slice(last, m.index) });
    out.push({ kind: "code", lang: m[1], code: m[2] });
    last = re.lastIndex;
  }
  if (last < src.length) out.push({ kind: "text", text: src.slice(last) });
  return out;
}

// 코드 블록을 뺀 글자만 (목록 제목 등에 사용)
export function plainText(src: string) {
  return parseSegments(src)
    .map((s) => (s.kind === "text" ? s.text : ""))
    .join(" ")
    .replace(/`/g, "");
}

type Props = {
  text: string;
  className?: string;
  dark?: boolean; // 초록 말풍선처럼 어두운 배경 위
  foldLines?: number; // 코드가 이 줄 수보다 길면 접어 두기 (담벼락 카드)
};

export function RichText({ text, className = "", dark, foldLines }: Props) {
  const segments = parseSegments(text);
  return (
    <div className={`min-w-0 break-words ${className}`}>
      {segments.map((s, i) => {
        if (s.kind === "text") {
          const t = s.text.replace(/^\n|\n$/g, "");
          return t ? (
            <p key={i} className="whitespace-pre-wrap">
              {inline(t, dark)}
            </p>
          ) : null;
        }
        if (s.lang === "error") return <ErrorBlock key={i} text={s.code} />;
        if (s.lang === "drawflow")
          return <DrawFlowCard key={i} encoded={s.code.trim()} foldHeight={foldLines ? 280 : 560} />;
        return <CodeBlock key={i} code={s.code} lang={s.lang} foldLines={foldLines} />;
      })}
    </div>
  );
}

function inline(text: string, dark?: boolean) {
  return text.split(/(`[^`\n]+`)/g).map((part, i) =>
    part.length > 2 && part.startsWith("`") && part.endsWith("`") ? (
      <code key={i} className={`rounded px-1 py-0.5 font-mono text-[0.9em] ${dark ? "bg-white/20" : "bg-ink/10"}`}>
        {part.slice(1, -1)}
      </code>
    ) : (
      part
    ),
  );
}

function ErrorBlock({ text }: { text: string }) {
  return (
    <div className="my-2 overflow-hidden rounded-lg border-2 border-[#D9534F] bg-[#FFF5F5] text-left text-ink">
      <div className="bg-[#D9534F] px-2.5 py-0.5 text-[11px] font-bold text-white">에러 메시지 · 실행 결과</div>
      <pre className="overflow-x-auto px-3 py-2 font-mono text-[13px] leading-relaxed text-[#8A1F1B]">{text}</pre>
    </div>
  );
}

// 새 탭을 먼저 열고(팝업 차단 방지) 주소를 나중에 넣습니다.
async function openInNewTab(makeUrl: () => Promise<string>) {
  const win = window.open("", "_blank");
  try {
    const url = await makeUrl();
    if (win) {
      win.opener = null;
      win.location.href = url;
    } else window.location.href = url;
  } catch {
    win?.close();
  }
}

// 글에 담긴 draw_flow 순서도 (계획서 2-8-1). 내용은 주소 그대로라 서버에 따로 저장하지 않습니다.
function DrawFlowCard({ encoded, foldHeight }: { encoded: string; foldHeight?: number }) {
  const [info, setInfo] = useState<{ title: string; doc: FlowDocument } | null | "bad">(null);
  useEffect(() => {
    let alive = true;
    decodeDrawFlowLink(encoded).then(
      (l) => alive && setInfo(l.kind === "flow" ? { title: l.title || l.doc.title, doc: l.doc } : "bad"),
      () => alive && setInfo("bad"),
    );
    return () => {
      alive = false;
    };
  }, [encoded]);
  if (info === "bad") return <p className="my-2 text-sm text-muted">(순서도를 읽을 수 없어요)</p>;
  return (
    <div className="my-2 flex flex-col gap-2 rounded-lg border border-school/40 bg-leaf p-2 text-left text-ink">
      {info && <FlowChart doc={info.doc} maxHeight={foldHeight} />}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <span aria-hidden>📐</span>
        <span className="min-w-0 flex-1 text-sm">
          <b>순서도</b>
          {info ? `${info.title ? ` · ${info.title}` : ""} (도형 ${info.doc.nodes.length}개)` : " 불러오는 중…"}
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openInNewTab(async () => drawFlowOpenUrl(encoded, "flow", currentBoardId()));
          }}
          className="rounded-lg bg-school px-3 py-1 text-sm text-white"
        >
          draw_flow에서 열기
        </button>
      </div>
    </div>
  );
}

function CodeBlock({ code, lang, foldLines }: { code: string; lang: string; foldLines?: number }) {
  const [copied, setCopied] = useState(false);
  const [open, setOpen] = useState(false);
  const lines = code.split("\n");
  const folded = Boolean(foldLines && !open && lines.length > foldLines);
  const shown = folded ? lines.slice(0, foldLines).join("\n") : code;
  const html = highlight(shown, lang);
  const count = folded ? foldLines! : lines.length;

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // 복사가 막힌 환경이면 무시
    }
  };

  return (
    <div className="code-block my-2 overflow-hidden rounded-lg bg-[#1C2B27] text-left">
      <div className="flex items-center justify-between bg-black/25 px-2.5 py-1 text-[11px] text-[#A9C3B8]">
        <span className="flex-1">{langLabel(lang)}</span>
        {/* 의사코드·파이썬은 draw_flow 에서 순서도로 바꿔 볼 수 있습니다 */}
        {(normalizeLang(lang) === "pseudocode" || normalizeLang(lang) === "python") && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              openInNewTab(async () =>
                drawFlowOpenUrl(
                  await encodePayload({
                    v: 1,
                    app: "class_board",
                    kind: "pseudocode",
                    title: "",
                    code,
                  }),
                  "pseudocode",
                  currentBoardId(),
                ),
              );
            }}
            className="rounded px-1.5 py-0.5 text-white/90 hover:bg-white/15"
            title="draw_flow에서 이 코드를 순서도로 바꿔 봅니다"
          >
            draw_flow에서 열기
          </button>
        )}
        <button type="button" onClick={copy} className="rounded px-1.5 py-0.5 text-white/90 hover:bg-white/15">
          {copied ? "복사됨 ✓" : "복사"}
        </button>
      </div>
      <div className="flex overflow-x-auto font-mono text-[13px] leading-[1.6]">
        <pre aria-hidden className="select-none border-r border-white/10 px-2 py-2 text-right text-[#6F8A80]">
          {Array.from({ length: count }, (_, i) => i + 1).join("\n")}
        </pre>
        {/* highlight() 가 코드 글자를 모두 이스케이프한 결과입니다 */}
        <pre className="flex-1 px-3 py-2 text-[#E6F2EC]">
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      </div>
      {folded && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
          }}
          className="w-full bg-black/25 py-1 text-xs text-[#CFE3DA] hover:bg-black/40"
        >
          더 보기 ({lines.length - foldLines!}줄 더)
        </button>
      )}
    </div>
  );
}
