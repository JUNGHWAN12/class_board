"use client";

import type { Session } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getSupabase, isConfigured, SCHOOL_DOMAIN } from "@/lib/supabase";

type AuthState = {
  loading: boolean;
  session: Session | null;
  userId: string | null;
  name: string;
  email: string;
  isSchoolUser: boolean;
  isTeacher: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("AuthProvider 안에서만 사용할 수 있습니다");
  return ctx;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(isConfigured);
  const [session, setSession] = useState<Session | null>(null);
  const [isSchoolUser, setIsSchoolUser] = useState(false);
  const [isTeacher, setIsTeacher] = useState(false);

  useEffect(() => {
    if (!isConfigured()) return;
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
    loading,
    session,
    userId: session?.user.id ?? null,
    name: (meta.full_name as string) || (meta.name as string) || session?.user.email || "",
    email: session?.user.email ?? "",
    isSchoolUser,
    isTeacher,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
