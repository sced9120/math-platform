import { NextResponse } from "next/server";
import { getDemoSubject } from "@/lib/demo";

// 공개 숫자 — hsorbit.uk 의 도구 소개 페이지가 "체험 활동 N개"를 읽어 간다.
//
// 안전 원칙
//  - 체험판(/demo)과 똑같은 공개 자료만 센다 (lib/demo.ts 의 규칙을 그대로 따른다).
//  - 숫자와 교과 이름만 돌려준다. 활동 내용·정답·학생 정보는 내보내지 않는다.
//  - 읽기만 한다. 로그인 없이 열리는 경로라 proxy.ts 의 공개 목록에 들어 있다.
//  - 다른 사이트(hsorbit.uk)에서 읽도록 CORS 를 연다. 공개 숫자라 출처를 가리지 않는다.
//  - Vercel 가장자리 캐시에 10분 두어, 방문이 몰려도 DB 를 매번 두드리지 않는다.

const HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, s-maxage=600, stale-while-revalidate=3600",
};

export async function GET() {
  try {
    const data = await getDemoSubject();
    const body = data
      ? {
          subject: data.subject.title,
          grade: data.subject.grade,
          units: data.units.length,
          activities: data.activities.length,
        }
      : { subject: null, grade: null, units: 0, activities: 0 };
    return NextResponse.json(body, { headers: HEADERS });
  } catch {
    return NextResponse.json({ error: "지금은 숫자를 불러올 수 없습니다." }, { status: 503, headers: { ...HEADERS, "Cache-Control": "no-store" } });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: HEADERS });
}
