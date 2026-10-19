"use client";

import Link from "next/link";
import { useAuth } from "./AuthProvider";
import { isConfigured, SCHOOL_DOMAIN } from "@/lib/supabase";

export function Header() {
  const { session, name, isTeacher, signOut } = useAuth();
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold text-slate-800">
          📋 수업 게시판
        </Link>
        {session && (
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-slate-600 sm:inline">
              {name}
              {isTeacher && (
                <span className="ml-1 rounded bg-indigo-100 px-1.5 py-0.5 text-xs text-indigo-700">교사</span>
              )}
            </span>
            <button onClick={signOut} className="rounded-md px-2 py-1 text-slate-500 hover:bg-slate-100">
              로그아웃
            </button>
          </div>
        )}
      </div>
    </header>
  );
}

// 로그인 + 학교 계정 확인을 통과해야 children 을 보여줍니다.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, session, isSchoolUser, email, signIn, signOut } = useAuth();

  if (!isConfigured()) {
    return (
      <Center>
        <p className="font-semibold">아직 Supabase 연결 설정이 없습니다.</p>
        <p className="mt-2 text-sm text-slate-500">README 의 설정 방법에 따라 환경 변수를 넣어주세요.</p>
      </Center>
    );
  }
  if (loading) {
    return <Center><p className="text-slate-500">불러오는 중…</p></Center>;
  }
  if (!session) {
    return (
      <Center>
        <h1 className="text-2xl font-bold text-slate-800">수업 게시판</h1>
        <p className="mt-2 text-slate-500">학교 구글 계정으로 로그인하세요.</p>
        <button
          onClick={signIn}
          className="mt-6 inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-3 font-medium shadow-sm hover:bg-slate-50"
        >
          <GoogleIcon /> 구글 계정으로 로그인
        </button>
      </Center>
    );
  }
  if (!isSchoolUser) {
    return (
      <Center>
        <p className="font-semibold">학교 계정이 아닙니다.</p>
        <p className="mt-2 text-sm text-slate-500">
          {email} 계정으로는 들어갈 수 없습니다.
          {SCHOOL_DOMAIN && <> @{SCHOOL_DOMAIN} 계정으로 다시 로그인해주세요.</>}
        </p>
        <button onClick={signOut} className="mt-6 rounded-lg bg-slate-800 px-4 py-2 text-white">
          다른 계정으로 로그인
        </button>
      </Center>
    );
  }
  return <>{children}</>;
}

function Center({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">{children}</div>;
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}
