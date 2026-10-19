import { demoStore } from "./demoStore";
import { isConfigured } from "./supabaseClient";
import { supabaseStore } from "./supabaseStore";
import type { BoardStore } from "./types";

export type { BoardStore } from "./types";
export { isConfigured, SCHOOL_DOMAIN } from "./supabaseClient";

// Supabase 키가 있으면 실제 DB, 없으면 체험 모드(브라우저 저장)
export function getStore(): BoardStore {
  return isConfigured() ? supabaseStore : demoStore;
}
