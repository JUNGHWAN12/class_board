"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { DEMO_STUDENTS, DEMO_TEACHER } from "@/lib/demo/users";
import { DRAW_FLOW_URL } from "@/lib/drawflow";

// 사이트 이름과 소개 문구 (머리글, 브라우저 탭 제목에 쓰임)
export const SITE_NAME = "info_board";
export const SITE_TAGLINE = "정보수업을 위한 게시판";

type Props = { subTitle: string; title: string; back?: boolean };

export function AppHeader({ subTitle, title, back }: Props) {
  const { demo, signedIn, name, isTeacher, switchDemoUser, signOut } = useAuth();
  return (
    <header className="bg-school text-white">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-3.5">
          {back && (
            <Link href="/" className="pill-btn">
              ← <span className="hidden sm:inline">게시판&nbsp;</span>목록
            </Link>
          )}
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-[13px] text-mint">{subTitle}</span>
            <h1 className="truncate font-display text-[30px] leading-tight">{title}</h1>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <a
            href={DRAW_FLOW_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="pill-btn"
            title="순서도·의사코드 사이트 draw_flow 를 새 탭에서 엽니다"
          >
            <span aria-hidden>📐</span> draw_flow
          </a>
          {signedIn && (
            <>
              {demo && (
                <button
                  type="button"
                  className="pill-btn"
                  onClick={() => switchDemoUser(isTeacher ? DEMO_STUDENTS[0].id : DEMO_TEACHER.id)}
                >
                  {isTeacher ? "학생 화면으로 보기" : "교사 화면으로 보기"}
                </button>
              )}
              <span className="flex h-10 items-center gap-2 rounded-full bg-school-mid py-0 pl-1 pr-3.5 text-sm">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sun text-ink" aria-hidden>
                  {initialOf(name, isTeacher)}
                </span>
                {demo && !isTeacher ? (
                  <select
                    aria-label="체험할 학생 고르기"
                    value={DEMO_STUDENTS.find((s) => s.name === name)?.id}
                    onChange={(e) => switchDemoUser(e.target.value)}
                    className="cursor-pointer bg-transparent text-white outline-none [&>option]:text-ink"
                  >
                    {DEMO_STUDENTS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} · 학교 계정
                      </option>
                    ))}
                  </select>
                ) : (
                  <span>{name}</span>
                )}
              </span>
              {!demo && (
                <button type="button" onClick={signOut} className="pill-btn">
                  로그아웃
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function initialOf(name: string, teacher = false) {
  if (teacher) return "선";
  // 한국 이름은 성을 빼고 이름 첫 글자 (김서연 → 서)
  const n = name.trim();
  return /^[가-힣]{3}$/.test(n) ? n[1] : n.slice(0, 1);
}
