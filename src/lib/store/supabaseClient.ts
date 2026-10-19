import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export const SCHOOL_DOMAIN = process.env.NEXT_PUBLIC_SCHOOL_DOMAIN || "";
export const IMAGE_BUCKET = "post-images";

// Supabase 키가 있으면 실제 DB, 없으면 브라우저에만 저장하는 체험 모드로 동작합니다.
export function isConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

// 브라우저에서만 호출합니다 (useEffect, 이벤트 핸들러 안).
export function getSupabase(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      throw new Error("Supabase 환경 변수가 설정되지 않았습니다 (.env.local 확인)");
    }
    client = createClient(url, key, {
      auth: { flowType: "pkce", persistSession: true, detectSessionInUrl: true },
    });
  }
  return client;
}
