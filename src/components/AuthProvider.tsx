"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getDemoUser, onDemoUserChange, setDemoUser, type DemoUser } from "@/lib/demo/users";
import { getSupabase, isConfigured, SCHOOL_DOMAIN } from "@/lib/store/supabaseClient";

type AuthState = {
  demo: boolean; // Supabase 없이 가상 사용자로 체험하는 중
  loading: boolean;
  signedIn: boolean;
  userId: string | null;
  name: string;
  email: string;
  avatar: string | null;
  isSchoolUser: boolean;
  isTeacher: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
  switchDemoUser: (id: string) => void;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider 안에서만 사용할 수 있습니다");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return isConfigured() ? <SupabaseAuth>{children}</SupabaseAuth> : <DemoAuth>{children}</DemoAuth>;
}

const noop = async () => {};

// 체험 모드: 머리글의 '교사 화면으로 보기' 버튼으로 교사·학생을 바꿉니다.
function DemoAuth({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<DemoUser | null>(null);

  useEffect(() => {
    // 저장된 사용자는 브라우저에서만 읽을 수 있어서 화면이 뜬 뒤에 불러옵니다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUser(getDemoUser());
    return onDemoUserChange(() => setUser(getDemoUser()));
  }, []);

  const value: AuthState = {
    demo: true,
    loading: user === null,
    signedIn: user !== null,
    userId: user?.id ?? null,
    name: user?.name ?? "",
    email: user?.email ?? "",
    avatar: null,
    isSchoolUser: true,
    isTeacher: user?.isTeacher ?? false,
    signIn: noop,
    signOut: noop,
    switchDemoUser: setDemoUser,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function SupabaseAuth({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [isSchoolUser, setIsSchoolUser] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    const supabase = getSupabase();
    let cancelled = false;
    let lastUserId: string | null | undefined;

    const load = async (s: Session | null) => {
      setSession(s);
      // 같은 사용자로 여러 번 불려도 권한 확인은 한 번만 합니다.
      const uid = s?.user.id ?? null;
      if (uid === lastUserId) return;
      lastUserId = uid;
      if (!s) {
        setIsSchoolUser(false);
        setIsTeacher(false);
        setLoading(false);
        return;
      }
      const [school, teacher] = await Promise.all([
        supabase.rpc("is_school_user"),
        supabase.rpc("is_teacher"),
      ]);
      if (cancelled) return;
      setIsSchoolUser(Boolean(school.data));
      setIsTeacher(Boolean(teacher.data));
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data }) => load(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        // 콜백 안에서 바로 Supabase 를 호출하면 막힐 수 있어 다음 틱으로 미룹니다.
        setTimeout(() => load(s), 0);
      } else {
        setSession(s);
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async () => {
    await getSupabase().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.href,
        // hd: 구글 로그인 화면에서 학교 계정만 보이도록 안내 (실제 차단은 DB 에서 합니다)
        queryParams: SCHOOL_DOMAIN ? { hd: SCHOOL_DOMAIN, prompt: "select_account" } : { prompt: "select_account" },
      },
    });
  }, []);

  const signOut = useCallback(async () => {
    await getSupabase().auth.signOut();
  }, []);

  const meta = session?.user.user_metadata ?? {};
  const value: AuthState = {
    demo: false,
    loading,
    signedIn: Boolean(session),
    userId: session?.user.id ?? null,
    name: (meta.full_name as string) || (meta.name as string) || session?.user.email || "",
    email: session?.user.email ?? "",
    avatar: (meta.avatar_url as string) || null,
    isSchoolUser,
    isTeacher,
    signIn,
    signOut,
    switchDemoUser: () => {},
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
