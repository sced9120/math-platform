import "server-only";
import { createClient } from "@supabase/supabase-js";

// service role 클라이언트 — RLS를 우회한다.
// 학생 계정 일괄 생성(STEP 3) 등 관리자 작업을 하는 API Route에서만 사용할 것.
// "server-only" import 덕분에 클라이언트 번들에 실수로 포함되면 빌드가 실패한다.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
