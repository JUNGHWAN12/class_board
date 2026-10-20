// draw_flow(순서도·의사코드 사이트)와 주고받는 링크 (계획서 2-8-1)
// 형식은 draw_flow 저장소 docs/BOARD_LINK.md 와 같아야 합니다. 받은 내용은 그대로 믿지 않고
// 약속한 필드만 남깁니다. 정답은 들어 있지 않습니다.

export const DRAW_FLOW_URL = (process.env.NEXT_PUBLIC_DRAW_FLOW_URL || "https://junghwan12.github.io/draw_flow/").replace(
  /\/?$/,
  "/",
);

/** 풀었을 때 JSON 크기 상한 (draw_flow 와 같음) */
export const MAX_PAYLOAD_BYTES = 50_000;

// ------------------------------------------------------------------ 압축 ↔ 글자
function toBase64Url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, limit = Infinity) {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      throw new Error("too large");
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    out.set(c, at);
    at += c.length;
  }
  return out;
}

export async function encodePayload(value: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(value));
  if (typeof CompressionStream !== "undefined") return "z" + toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
  return "j" + toBase64Url(json);
}

export async function decodePayload(s: string): Promise<unknown> {
  if (!/^[zj][A-Za-z0-9_-]+$/.test(s)) throw new Error("bad");
  let bytes = fromBase64Url(s.slice(1));
  if (s[0] === "z") bytes = await pipe(bytes, new DecompressionStream("deflate-raw"), MAX_PAYLOAD_BYTES);
  if (bytes.length > MAX_PAYLOAD_BYTES) throw new Error("too large");
  return JSON.parse(new TextDecoder().decode(bytes));
}

// ------------------------------------------------------------------ 형식
export type ProblemMode = "code2flow" | "flow2code";
export type Verdict = "correct" | "partial" | "wrong";

type FlowNode = { id: string; kind: "terminal" | "process" | "decision"; label: string; line?: number; x: number; y: number; width: number; height: number };
type FlowEdge = {
  id: string;
  source: string;
  target: string;
  sourceHandle: string;
  targetHandle: string;
  label?: string;
  points?: { x: number; y: number }[];
};
export type FlowDocument = { app: "draw_flow"; version: 1; title: string; pseudocode?: string; nodes: FlowNode[]; edges: FlowEdge[] };

type Base = { v: 1; app: "draw_flow" | "class_board"; title: string };
export type DrawFlowLink =
  | (Base & { kind: "pseudocode"; code: string })
  | (Base & { kind: "flow"; doc: FlowDocument })
  | (Base & {
      kind: "submission";
      problem: { id: string; title: string; mode: ProblemMode };
      code?: string;
      doc?: FlowDocument;
      grade: { verdict: Verdict; items: { ok: boolean; text: string }[] };
    });

const MAX_TITLE = 100;
const MAX_SHAPES = 500;

function fail(): never {
  throw new Error("invalid");
}
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null && !Array.isArray(v);
function str(v: unknown, max = Infinity): string {
  if (typeof v !== "string") fail();
  return v.slice(0, max);
}
function num(v: unknown): number {
  if (typeof v !== "number" || !Number.isFinite(v)) fail();
  return v;
}

function cleanNode(v: unknown): FlowNode {
  if (!isObj(v) || !["terminal", "process", "decision"].includes(v.kind as string)) fail();
  return {
    id: str(v.id, 64),
    kind: v.kind as FlowNode["kind"],
    label: str(v.label, 500),
    ...(typeof v.line === "number" ? { line: num(v.line) } : {}),
    x: num(v.x),
    y: num(v.y),
    width: num(v.width),
    height: num(v.height),
  };
}

function cleanEdge(v: unknown): FlowEdge {
  const sides = ["t", "r", "b", "l"];
  if (!isObj(v) || !sides.includes(v.sourceHandle as string) || !sides.includes(v.targetHandle as string)) fail();
  if (v.label !== undefined && v.label !== "예" && v.label !== "아니오") fail();
  if (v.points !== undefined && (!Array.isArray(v.points) || v.points.length > MAX_SHAPES)) fail();
  return {
    id: str(v.id, 64),
    source: str(v.source, 64),
    target: str(v.target, 64),
    sourceHandle: v.sourceHandle as string,
    targetHandle: v.targetHandle as string,
    ...(v.label !== undefined ? { label: v.label as string } : {}),
    ...(v.points !== undefined
      ? {
          points: (v.points as unknown[]).map((p) => {
            if (!isObj(p)) fail();
            return { x: num(p.x), y: num(p.y) };
          }),
        }
      : {}),
  };
}

function cleanDoc(v: unknown): FlowDocument {
  if (!isObj(v) || v.app !== "draw_flow" || !Array.isArray(v.nodes) || !Array.isArray(v.edges)) fail();
  if (v.nodes.length > MAX_SHAPES || v.edges.length > MAX_SHAPES) fail();
  return {
    app: "draw_flow",
    version: 1,
    title: typeof v.title === "string" ? v.title.slice(0, MAX_TITLE) : "",
    ...(typeof v.pseudocode === "string" ? { pseudocode: v.pseudocode } : {}),
    nodes: v.nodes.map(cleanNode),
    edges: v.edges.map(cleanEdge),
  };
}

export function parseDrawFlowLink(value: unknown): DrawFlowLink {
  if (!isObj(value) || value.v !== 1 || (value.app !== "draw_flow" && value.app !== "class_board")) fail();
  const base: Base = { v: 1, app: value.app, title: str(value.title ?? "", MAX_TITLE) };
  switch (value.kind) {
    case "pseudocode":
      return { ...base, kind: "pseudocode", code: str(value.code) };
    case "flow":
      return { ...base, kind: "flow", doc: cleanDoc(value.doc) };
    case "submission": {
      const p = value.problem;
      const g = value.grade;
      if (!isObj(p) || (p.mode !== "code2flow" && p.mode !== "flow2code")) fail();
      if (!isObj(g) || !["correct", "partial", "wrong"].includes(g.verdict as string) || !Array.isArray(g.items)) fail();
      const code = value.code === undefined ? undefined : str(value.code);
      const doc = value.doc === undefined ? undefined : cleanDoc(value.doc);
      if (code === undefined && doc === undefined) fail();
      return {
        ...base,
        kind: "submission",
        problem: { id: str(p.id, 32), title: str(p.title, MAX_TITLE), mode: p.mode },
        ...(code !== undefined ? { code } : {}),
        ...(doc !== undefined ? { doc } : {}),
        grade: {
          verdict: g.verdict as Verdict,
          items: g.items.slice(0, 50).map((it) => {
            if (!isObj(it)) fail();
            return { ok: it.ok === true, text: str(it.text, 300) };
          }),
        },
      };
    }
    default:
      return fail();
  }
}

export async function decodeDrawFlowLink(s: string): Promise<DrawFlowLink> {
  try {
    return parseDrawFlowLink(await decodePayload(s));
  } catch {
    throw new Error("draw_flow에서 보낸 내용을 읽을 수 없어요. 링크가 잘리지 않았는지 확인해 주세요.");
  }
}

// ------------------------------------------------------------------ 게시판 ↔ draw_flow 주소
const isBoardId = (id: unknown): id is string => typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);

/** draw_flow 가 보낸 주소의 # 뒷부분(d=…&board=…)을 읽습니다. */
export function readShareHash(hash: string): { d: string | null; board: string | null } {
  const params = new URLSearchParams(hash.replace(/^#/, ""));
  const d = params.get("d");
  const board = params.get("board");
  return { d: d && /^[zj][A-Za-z0-9_-]+$/.test(d) ? d : null, board: isBoardId(board) ? board : null };
}

/** 게시판 → draw_flow 로 여는 주소 (순서도는 편집기, 의사코드는 변환 화면) */
export function drawFlowOpenUrl(encoded: string, kind: "pseudocode" | "flow", boardId?: string | null) {
  const board = isBoardId(boardId) ? `&board=${boardId}` : "";
  return `${DRAW_FLOW_URL}#/${kind === "flow" ? "editor" : "convert"}?src=${encoded}${board}`;
}

/** 지금 보고 있는 게시판 아이디 (/board/아이디) */
export function currentBoardId(): string | null {
  const m = typeof window === "undefined" ? null : window.location.pathname.match(/^\/board\/([^/]+)/);
  return m && isBoardId(m[1]) ? m[1] : null;
}

// ------------------------------------------------------------------ 받은 내용 → 글 초안
export type PostDraft = { kind: "code" | "assignment"; title: string; content: string };

const MODE_NAME: Record<ProblemMode, string> = { code2flow: "코드 보고 순서도 그리기", flow2code: "순서도 보고 코드 쓰기" };
const VERDICT_NAME: Record<Verdict, string> = { correct: "맞음", partial: "부분 정답", wrong: "아직 틀림" };

const codeBlock = (lang: string, code: string) => "```" + lang + "\n" + code.replace(/\s+$/, "") + "\n```";

/** 순서도를 글 안에 담는 블록. 글에서는 [draw_flow에서 열기] 카드로 보입니다. */
async function flowBlock(title: string, doc: FlowDocument) {
  return codeBlock("drawflow", await encodePayload({ v: 1, app: "class_board", kind: "flow", title, doc }));
}

/** 순서도와 의사코드가 함께 왔을 때 무엇을 올릴지 */
export type ShareContent = "both" | "flow" | "code";

/** 순서도와 의사코드가 둘 다 들어 있어 고를 수 있는 내용인지 */
export function hasFlowAndCode(link: DrawFlowLink): boolean {
  return link.kind === "flow" && !!link.doc.pseudocode?.trim() && link.doc.nodes.length > 0;
}

export async function draftFromLink(link: DrawFlowLink, content: ShareContent = "both"): Promise<PostDraft> {
  if (link.kind === "pseudocode") {
    return { kind: "code", title: link.title, content: codeBlock("pseudocode", link.code) };
  }
  if (link.kind === "flow") {
    const pick = hasFlowAndCode(link) ? content : "both";
    const parts: string[] = [];
    if (pick !== "code") parts.push(await flowBlock(link.title || link.doc.title, link.doc));
    if (pick !== "flow" && link.doc.pseudocode?.trim()) parts.push(codeBlock("pseudocode", link.doc.pseudocode));
    return { kind: "code", title: link.title || link.doc.title, content: parts.join("\n") };
  }
  const g = link.grade;
  const parts = [
    `📝 draw_flow 문제: ${link.problem.title} (${MODE_NAME[link.problem.mode]})`,
    `자동 채점: ${VERDICT_NAME[g.verdict]} (참고용)`,
    ...g.items.map((it) => `${it.ok ? "✔" : "✘"} ${it.text}`),
  ];
  if (link.doc) parts.push(await flowBlock(link.problem.title, link.doc));
  if (link.code?.trim()) parts.push(codeBlock("pseudocode", link.code));
  return { kind: "assignment", title: `[제출] ${link.problem.title}`, content: parts.join("\n") };
}

// ------------------------------------------------------------------ /share → 게시판 글쓰기 창
const DRAFT_KEY = "class-board:share-draft";
const INCOMING_KEY = "class-board:share-incoming";

/** 고른 게시판에서 글쓰기 창을 열 때 채울 내용을 잠시 맡겨 둡니다 (탭 안에서만) */
export function putDraft(boardId: string, draft: PostDraft) {
  try {
    sessionStorage.setItem(DRAFT_KEY, JSON.stringify({ boardId, draft }));
  } catch {
    // 저장을 못 하면 글쓰기 창이 빈 채로 열립니다
  }
}

/** 이 게시판에 맡겨 둔 내용이 있으면 꺼내고 지웁니다 */
export function takeDraft(boardId: string): PostDraft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const v = JSON.parse(raw) as { boardId: string; draft: PostDraft };
    if (v.boardId !== boardId) return null;
    sessionStorage.removeItem(DRAFT_KEY);
    return v.draft;
  } catch {
    return null;
  }
}

/** 로그인하러 다녀오는 사이 주소의 # 뒤 내용이 사라질 수 있어 미리 맡겨 둡니다 */
export function stashIncoming(hash: string) {
  try {
    if (readShareHash(hash).d) sessionStorage.setItem(INCOMING_KEY, hash);
  } catch {
    // 무시
  }
}

export function takeIncoming(): string {
  try {
    const h = sessionStorage.getItem(INCOMING_KEY) ?? "";
    sessionStorage.removeItem(INCOMING_KEY);
    return h;
  } catch {
    return "";
  }
}
