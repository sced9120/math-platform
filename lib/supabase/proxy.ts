import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// 모든 요청에서 Supabase 세션 쿠키를 갱신하고, 비로그인 접근을 /login으로 돌린다.
// 루트의 proxy.ts에서 호출된다.
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 주의: createServerClient와 getUser() 사이에 다른 로직을 넣지 말 것.
  // 세션 토큰 갱신이 이 호출에서 일어나므로 순서가 어긋나면 무작위 로그아웃이 발생한다.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isLoginPage = path.startsWith("/login");
  // 최초 설정 화면과 그 API 는 계정이 하나도 없을 때 쓰는 곳이라 로그인 없이 열어 둔다.
  // (실제 생성 가능 여부는 /api/setup 에서 "관리자·교사 계정 0개"인지 서버가 직접 확인한다)
  const isSetup = path.startsWith("/setup") || path.startsWith("/api/setup");
  // 체험판 — 로그인 없이 둘러보는 읽기 전용 화면. 저장·AI 는 전부 막혀 있다.
  const isDemo = path.startsWith("/demo");

  if (!user && !isLoginPage && !isSetup && !isDemo) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && isLoginPage) {
    const url = request.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
