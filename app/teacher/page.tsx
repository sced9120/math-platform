import Link from "next/link";

// 교사 대시보드 — 관리 메뉴 진입점 (권한 가드는 layout에서 처리)
export default function TeacherPage() {
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
            명단(학년,반,번호,이름)으로 계정 일괄 생성 · 초기비밀번호 배포
          </p>
        </Link>

        <Link
          href="/teacher/units"
          className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-blue-400"
        >
          <h3 className="mb-1 font-semibold text-zinc-900">단원/활동 관리</h3>
          <p className="text-sm text-zinc-500">
            단원 만들기 · GeoGebra/자료/문제 활동 구성 · 공개 설정
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
      </div>
    </div>
  );
}
