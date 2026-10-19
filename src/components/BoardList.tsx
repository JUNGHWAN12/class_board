"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useAuth } from "./AuthProvider";
import { AppHeader, CLASS_NAME } from "./AppHeader";
import { Modal } from "./Modal";
import { getStore } from "@/lib/store";
import { usePolling } from "@/lib/usePolling";
import { KINDS, VIEWS, viewLabel, type Board, type PostKind, type RevealMode, type ViewKey } from "@/lib/types";

// 첫 화면: 주제별로 독립된 게시판 카드
export function BoardList() {
  const { isTeacher } = useAuth();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    try {
      const list = await getStore().listBoards();
      setBoards(list.sort((a, b) => a.created_at.localeCompare(b.created_at)));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, []);

  usePolling(load, 30000);

  return (
    <>
      <AppHeader subTitle={`${CLASS_NAME} · 정보 · 인공지능 · 데이터 과학`} title="우리 반 게시판" />
      <main className="mx-auto box-border flex w-full max-w-[1240px] flex-col gap-4 px-4 pb-10 pt-7 sm:px-6">
        <p className="text-[15px] text-ink-soft">
          게시판마다 글·댓글·좋아요가 따로 관리돼요. 들어가서 원하는 보기로 바꿔 볼 수 있어요.
        </p>
        {error && <p className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="grid grid-cols-[repeat(auto-fill,minmax(270px,1fr))] gap-[18px]">
          {boards === null && <p className="text-muted">불러오는 중…</p>}
          {boards?.length === 0 && !isTeacher && <p className="text-muted">아직 게시판이 없어요.</p>}
          {boards?.map((b) => (
            <Link
              key={b.id}
              href={`/board/${b.id}`}
              className="flex min-h-[180px] flex-col gap-2.5 rounded-xl border border-t-[6px] border-line border-t-school bg-white p-[18px] !text-ink transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex w-full items-center justify-between text-[13px] text-ink-soft">
                <span>{b.subject}</span>
                {b.is_locked ? (
                  <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs text-white">잠김</span>
                ) : (
                  <span className="rounded-full bg-leaf px-2.5 py-0.5 text-xs text-school">열림</span>
                )}
              </span>
              <span className="font-display text-[25px] leading-tight">{b.title}</span>
              <span className="text-sm leading-relaxed text-ink-soft">{b.description}</span>
              <span className="mt-auto flex gap-3 text-[13px] text-ink-soft">
                <span>글 {b.post_count}개</span>
                <span>기본 보기: {viewLabel(b.default_view)}</span>
              </span>
            </Link>
          ))}
          {isTeacher && boards !== null && (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="min-h-[180px] rounded-xl border-2 border-dashed border-[#9AA9A3] text-[17px] text-school hover:bg-white"
            >
              + 새 주제 게시판 만들기
            </button>
          )}
        </div>
      </main>
      {creating && (
        <NewBoardModal
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false);
            load();
          }}
        />
      )}
    </>
  );
}

function NewBoardModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { userId } = useAuth();
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("정보 · ");
  const [description, setDescription] = useState("");
  const [notice, setNotice] = useState("");
  const [sections, setSections] = useState("");
  const [view, setView] = useState<ViewKey>("wall");
  const [kind, setKind] = useState<PostKind>("general");
  const [reveal, setReveal] = useState<RevealMode>("open");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !userId) return;
    setSaving(true);
    try {
      await getStore().createBoard(
        {
          title: title.trim(),
          subject: subject.trim(),
          description: description.trim(),
          notice: notice.trim(),
          sections: sections
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 8),
          default_view: view,
          default_kind: kind,
          reveal_mode: reveal,
        },
        userId,
      );
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <Modal title={<b className="font-display text-xl font-normal">새 주제 게시판 만들기</b>} onClose={onClose}>
      <form onSubmit={submit} className="flex flex-col gap-3 text-sm">
        <label className="flex flex-col gap-1">
          게시판 이름
          <input className="field" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="예: 파이썬 코드 나눔" autoFocus />
        </label>
        <label className="flex flex-col gap-1">
          과목 · 활동
          <input className="field" value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={40} />
        </label>
        <label className="flex flex-col gap-1">
          설명
          <input className="field" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} placeholder="카드에 보이는 한 줄 설명" />
        </label>
        <label className="flex flex-col gap-1">
          선생님 공지 (대화 보기 위에 고정)
          <input className="field" value={notice} onChange={(e) => setNotice(e.target.value)} maxLength={300} />
        </label>
        <label className="flex flex-col gap-1">
          칸 이름 (쉼표로 구분, 칸별 보기에 쓰여요)
          <input className="field" value={sections} onChange={(e) => setSections(e.target.value)} placeholder="예: 1모둠, 2모둠, 3모둠" />
        </label>
        <fieldset className="flex flex-col gap-1">
          <legend className="mb-1">기본 보기</legend>
          <div className="flex flex-wrap gap-1 rounded-xl bg-tab p-1">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => setView(v.key)}
                className={`min-h-9 rounded-lg px-3 ${view === v.key ? "bg-school text-white" : ""}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex flex-col gap-1">
          기본 글 종류
          <select className="field" value={kind} onChange={(e) => setKind(e.target.value as PostKind)}>
            {KINDS.map((k) => (
              <option key={k.key} value={k.key}>
                {k.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          친구 글 공개 (과제 게시판은 베끼기 방지로 &apos;제출하면&apos; 추천)
          <select className="field" value={reveal} onChange={(e) => setReveal(e.target.value as RevealMode)}>
            <option value="open">항상 공개</option>
            <option value="after_submit">내 글을 올리면 공개</option>
            <option value="teacher">교사가 공개할 때까지 비공개</option>
          </select>
        </label>
        {error && <p className="rounded-lg bg-red-50 p-2 text-red-700">{error}</p>}
        <button disabled={saving || !title.trim()} className="write-btn mt-1 self-end">
          {saving ? "만드는 중…" : "만들기"}
        </button>
      </form>
    </Modal>
  );
}
