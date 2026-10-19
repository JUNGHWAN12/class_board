"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { getSupabase } from "@/lib/supabase";
import type { Board } from "@/lib/types";

export function BoardList() {
  const { isTeacher, userId } = useAuth();
  const [boards, setBoards] = useState<Board[] | null>(null);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await getSupabase()
      .from("boards")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) setError(error.message);
    else setBoards(data as Board[]);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 첫 화면에 게시판 목록을 불러옵니다
    load();
  }, [load]);

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !userId) return;
    setSaving(true);
    const { error } = await getSupabase()
      .from("boards")
      .insert({ title: title.trim(), description: description.trim(), owner_id: userId });
    setSaving(false);
    if (error) return setError(error.message);
    setTitle("");
    setDescription("");
    load();
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold">게시판 목록</h1>

      {isTeacher && (
        <form onSubmit={create} className="mt-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="font-semibold">새 게시판 만들기</p>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={100}
            placeholder="게시판 이름 (예: 2학년 3반 국어 - 시 감상)"
            className="mt-3 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={1000}
            rows={2}
            placeholder="안내 문구 (선택)"
            className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2"
          />
          <button
            disabled={saving || !title.trim()}
            className="mt-2 rounded-lg bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-50"
          >
            {saving ? "만드는 중…" : "만들기"}
          </button>
        </form>
      )}

      {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <ul className="mt-6 grid gap-3 sm:grid-cols-2">
        {boards === null && <li className="text-slate-500">불러오는 중…</li>}
        {boards?.length === 0 && <li className="text-slate-500">아직 게시판이 없습니다.</li>}
        {boards?.map((b) => (
          <li key={b.id}>
            <Link
              href={`/board/${b.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-indigo-300 hover:shadow"
            >
              <p className="font-semibold">
                {b.is_locked && <span title="잠김">🔒 </span>}
                {b.title}
              </p>
              {b.description && <p className="mt-1 line-clamp-2 text-sm text-slate-500">{b.description}</p>}
              <p className="mt-2 text-xs text-slate-400">{new Date(b.created_at).toLocaleDateString("ko-KR")}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
