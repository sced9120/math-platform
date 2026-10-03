import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// 사이트 설정 (마이그레이션 0016 의 site_settings — 서버만 읽고 쓴다)

// 누구나 교사로 가입할 수 있는가.
//  - 표가 아직 없으면(마이그레이션 전) 막아 둔다 — 자료 분리 정책 없이 가입이 열리면 안 되기 때문.
//  - 관리자가 아직 없으면(갓 설치한 사이트) 막아 둔다 — 낯선 사람이 먼저 가입하면
//    "계정이 0개일 때만" 열리는 최초 설정(/setup)이 잠겨 주인이 관리자를 못 만들게 된다.
export async function isSignupOpen(): Promise<boolean> {
  try {
    const db = createAdminClient();
    const [{ data, error }, { count }] = await Promise.all([
      db
        .from("site_settings")
        .select("value")
        .eq("key", "open_signup")
        .maybeSingle<{ value: unknown }>(),
      db.from("profiles").select("id", { count: "exact", head: true }).eq("role", "admin"),
    ]);
    if (error) return false;
    return data?.value === true && (count ?? 0) > 0;
  } catch {
    return false;
  }
}

export async function setSignupOpen(open: boolean): Promise<void> {
  const { error } = await createAdminClient()
    .from("site_settings")
    .upsert({ key: "open_signup", value: open, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}
