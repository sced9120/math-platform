import Link from "next/link";
import { requireProfile } from "@/lib/auth";

// 교사 대시보드 — 관리 메뉴 진입점 (권한 가드는 layout에서 처리)
export default async function TeacherPage() {
  const profile = await requireProfile();
  const admin = profile.role === "admin";

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-zinc-900">관리 메뉴</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/teacher/students"
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-blue-400"
        >
          <h3 className="mb-1 font-semibold text-zinc-900">학생 관리</h3>
          <p className="text-sm text-zinc-500">
            명단(학년,반,번호,이름,비밀번호)으로 계정 일괄 생성 · 비밀번호 재설정
          </p>
        </Link>

        <Link
          href="/teacher/units"
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-blue-400"
        >
          <h3 className="mb-1 font-semibold text-zinc-900">단원·소단원 관리</h3>
          <p className="text-sm text-zinc-500">
            단원 만들기 · GeoGebra/자료/문제 활동 구성 · 공개 설정
          </p>
        </Link>

        <Link
          href="/teacher/progress"
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-blue-400"
        >
          <h3 className="mb-1 font-semibold text-zinc-900">진도 현황</h3>
          <p className="text-sm text-zinc-500">
            반별·활동별 완료율을 한눈에 보고, 막힌 지점 찾기
          </p>
        </Link>

        <Link
          href="/teacher/subjects"
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-blue-400"
        >
          <h3 className="mb-1 font-semibold text-zinc-900">교과 관리</h3>
          <p className="text-sm text-zinc-500">
            교과(공통수학2 등) 만들기 · 단원을 교과에 배치 · 공개 설정
          </p>
        </Link>

        <Link
          href="/teacher/export"
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-blue-400"
        >
          <h3 className="mb-1 font-semibold text-zinc-900">기록 다운로드</h3>
          <p className="text-sm text-zinc-500">
            학생·반·활동을 선택해 제출 기록을 CSV(엑셀)로 다운로드
          </p>
        </Link>

        {admin && (
          <>
            <Link
              href="/teacher/teachers"
              className="rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm hover:border-blue-400"
            >
              <h3 className="mb-1 font-semibold text-zinc-900">
                교사 관리 <span className="text-xs font-normal text-blue-600">관리자</span>
              </h3>
              <p className="text-sm text-zinc-500">교사 계정 만들기 · 초기비밀번호 배포 · 삭제</p>
            </Link>
            <Link
              href="/teacher/prompts"
              className="rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm hover:border-blue-400"
            >
              <h3 className="mb-1 font-semibold text-zinc-900">
                AI 프롬프트 <span className="text-xs font-normal text-blue-600">관리자</span>
              </h3>
              <p className="text-sm text-zinc-500">
                문답·첨삭 AI의 성격·규칙을 코드 수정 없이 편집
              </p>
            </Link>
            <Link
              href="/teacher/ai-settings"
              className="rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm hover:border-blue-400"
            >
              <h3 className="mb-1 font-semibold text-zinc-900">
                AI 키·모델 <span className="text-xs font-normal text-blue-600">관리자</span>
              </h3>
              <p className="text-sm text-zinc-500">
                OpenAI·Gemini·Claude API 키 등록 + 학생이 고를 모델 관리
              </p>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
