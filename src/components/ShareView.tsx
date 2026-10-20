"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { AppHeader, SITE_NAME } from "./AppHeader";
import { useAuth } from "./AuthProvider";
import { RichText } from "./RichText";
import { getStore } from "@/lib/store";
import { kindLabel, type Board } from "@/lib/types";
import {
  decodeDrawFlowLink,
  draftFromLink,
  hasFlowAndCode,
  putDraft,
  readShareHash,
  stashIncoming,
  takeIncoming,
  type DrawFlowLink,
  type PostDraft,
  type ShareContent,
} from "@/lib/drawflow";

const CONTENT_CHOICES: { key: ShareContent; label: string }[] = [
  { key: "both", label: "순서도 + 의사코드" },
  { key: "flow", label: "순서도만" },
  { key: "code", label: "의사코드만" },
];

// 로그인 전에 주소의 내용을 맡겨 둡니다 (로그인하러 다녀오면 # 뒤가 사라질 수 있어서).
export function ShareStash() {
  useEffect(() => stashIncoming(window.location.hash), []);
  return null;
}

// draw_flow 에서 받은 내용을 확인하고, 게시판을 골라 글쓰기 창에 채워서 엽니다.
// 자동으로 올리지 않습니다. 학생이 글쓰기 창에서 확인한 뒤 [올리기]를 누릅니다.
export function ShareView() {
  const router = useRouter();
  const { isTeacher } = useAuth();
  const [draft, setDraft] = useState<PostDraft | null>(null);
  const [error, setError] = useState("");
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [boardId, setBoardId] = useState("");
  const [link, setLink] = useState<DrawFlowLink | null>(null);
  const [content, setContent] = useState<ShareContent>("both");

  useEffect(() => {
    const hash = window.location.hash || takeIncoming();
    takeIncoming();
    const { d, board } = readShareHash(hash);
    // 새로고침해도 다시 받지 않도록 주소에서 내용을 지웁니다
    if (window.location.hash) history.replaceState(null, "", window.location.pathname);
    if (!d) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- 주소는 화면이 뜬 뒤에 읽습니다
      setError("draw_flow에서 보낸 내용이 없어요. draw_flow의 [게시판에 올리기] 버튼으로 다시 열어 주세요.");
      return;
    }
    let alive = true;
    decodeDrawFlowLink(d).then(
      (l) => alive && setLink(l),
      (e: Error) => alive && setError(e.message),
    );
    getStore()
      .listBoards()
      .then(
        (list) => {
          if (!alive) return;
          setBoards(list);
          const open = list.filter((b) => !b.is_locked || isTeacher);
          setBoardId((open.find((b) => b.id === board) ?? open[0])?.id ?? "");
        },
        (e: Error) => alive && setError(e.message),
      );
    return () => {
      alive = false;
    };
    // isTeacher 는 처음 한 번만 봅니다 (로그인 뒤에만 이 화면이 보임)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 고른 내용(둘 다 / 순서도만 / 의사코드만)으로 미리보기와 글쓰기 내용을 만듭니다
  useEffect(() => {
    if (!link) return;
    let alive = true;
    draftFromLink(link, content).then(
      (dr) => alive && setDraft(dr),
      (e: Error) => alive && setError(e.message),
    );
    return () => {
      alive = false;
    };
  }, [link, content]);

  const go = () => {
    if (!draft || !boardId) return;
    putDraft(boardId, draft);
    router.push(`/board/${boardId}`);
  };

  return (
    <>
      <AppHeader subTitle={SITE_NAME} title="draw_flow에서 보낸 글" back />
      <main className="mx-auto box-border flex w-full max-w-[860px] flex-col gap-4 px-4 pb-10 pt-7 sm:px-6">
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {!error && !draft && <p className="text-muted">불러오는 중…</p>}
        {draft && (
          <>
            <section className="rounded-xl border border-line bg-white p-4">
              <p className="mb-2 text-sm text-ink-soft">
                글 종류: <b>{kindLabel(draft.kind)}</b>
                {draft.title && (
                  <>
                    {" "}
                    · 제목: <b>{draft.title}</b>
                  </>
                )}
              </p>
              <RichText text={draft.content} className="text-[15px] leading-relaxed" />
            </section>
            <section className="flex flex-col gap-3 rounded-xl border border-line bg-white p-4">
              {link && hasFlowAndCode(link) && (
                <fieldset className="flex flex-col gap-1.5 text-sm">
                  <legend className="mb-1">무엇을 올릴까요?</legend>
                  <div className="flex flex-wrap gap-2">
                    {CONTENT_CHOICES.map((c) => (
                      <label
                        key={c.key}
                        className={`cursor-pointer rounded-full border px-3.5 py-1.5 ${
                          content === c.key ? "border-school bg-school text-white" : "border-line bg-white text-ink"
                        }`}
                      >
                        <input
                          type="radio"
                          name="share-content"
                          value={c.key}
                          checked={content === c.key}
                          onChange={() => setContent(c.key)}
                          className="sr-only"
                        />
                        {c.label}
                      </label>
                    ))}
                  </div>
                </fieldset>
              )}
              <label className="flex flex-col gap-1 text-sm">
                어느 게시판에 올릴까요?
                <select
                  value={boardId}
                  onChange={(e) => setBoardId(e.target.value)}
                  className="field"
                  disabled={!boards}
                >
                  {boards === null && <option>불러오는 중…</option>}
                  {boards?.map((b) => (
                    <option key={b.id} value={b.id} disabled={b.is_locked && !isTeacher}>
                      {b.title} ({b.subject}){b.is_locked && !isTeacher ? " · 잠김" : ""}
                    </option>
                  ))}
                </select>
              </label>
              {boards?.length === 0 && <p className="text-sm text-muted">아직 게시판이 없어요.</p>}
              <p className="text-xs text-muted">
                글쓰기 창에 내용이 채워져 열려요. 확인한 뒤 [올리기]를 눌러야 올라가요.
              </p>
              <button type="button" onClick={go} disabled={!boardId} className="write-btn self-end">
                이 게시판에 글쓰기
              </button>
            </section>
          </>
        )}
      </main>
    </>
  );
}
