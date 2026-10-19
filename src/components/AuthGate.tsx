"use client";

import { useAuth } from "./AuthProvider";
import { AppHeader, CLASS_NAME } from "./AppHeader";
import { DemoFooter } from "./DemoFooter";
import { SCHOOL_DOMAIN } from "@/lib/store";

// 로그인 + 학교 계정 확인을 통과해야 children 을 보여줍니다.
// 체험 모드(Supabase 키 없음)에서는 가상 사용자로 바로 들어갑니다.
export function AuthGate({ children }: { children: React.ReactNode }) {
  const { loading, signedIn, isSchoolUser, email, signIn, signOut } = useAuth();

  if (loading) {
    return (
      <Shell>
        <p className="text-muted">불러오는 중…</p>
      </Shell>
    );
  }
  if (!signedIn) {
    return (
      <Shell>
        <p className="text-ink-soft">학교 구글 계정으로 로그인하세요.</p>
        <button
          onClick={signIn}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-line bg-white px-5 py-3 font-medium shadow-sm hover:bg-paper"
        >
          <GoogleIcon /> 구글 계정으로 로그인
        </button>
      </Shell>
    );
  }
  if (!isSchoolUser) {
    return (
      <Shell>
        <p className="font-semibold">학교 계정이 아닙니다.</p>
        <p className="mt-2 text-sm text-ink-soft">
          {email} 계정으로는 들어갈 수 없습니다.
          {SCHOOL_DOMAIN && <> @{SCHOOL_DOMAIN} 계정으로 다시 로그인해주세요.</>}
        </p>
        <button onClick={signOut} className="mt-6 rounded-xl bg-school px-4 py-2 text-white">
          다른 계정으로 로그인
        </button>
      </Shell>
    );
  }
  return (
    <>
      {children}
      <DemoFooter />
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AppHeader subTitle={CLASS_NAME} title="우리 반 게시판" />
      <div className="flex flex-1 flex-col items-center justify-center px-4 py-24 text-center">{children}</div>
    </>
  );
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
