import Link from "next/link";
import { requireProfile } from "@/lib/auth";
import { adminStillTeaching } from "@/lib/admin-handover";
import ArchivePublish from "@/components/teacher/archive-publish";

const card =
  "rounded-xl border border-zinc-200 bg-white p-6 shadow-sm hover:border-blue-400";

// 교사 대시보드 — 관리 메뉴 진입점 (권한 가드는 layout에서 처리)
//  관리자는 교사 계정만 관리한다. 아직 학생·자료를 갖고 있으면 넘기라고 안내하고,
//  넘기기 전까지는 수업 메뉴도 함께 보여 준다.
export default async function TeacherPage() {
  const profile = await requireProfile();
  const admin = profile.role === "admin";
  const teaching = !admin || (await adminStillTeaching(profile.id));

  return (
    <div>
      <h2 className="mb-6 text-lg font-semibold text-zinc-900">관리 메뉴</h2>

      {admin && teaching && (
        <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <b>관리자 계정은 이제 교사 계정만 관리합니다.</b> 이 계정에 아직 학생·자료가 있습니다.
          <br />
          수업에 쓸 교사 계정을 만든 뒤,{" "}
          <Link href="/teacher/teachers#handover" className="font-medium underline">
            교사 관리 → 내 학생·자료 넘기기
          </Link>
          로 옮겨 주세요. 학생은 지금처럼 학번만으로 로그인하고, AI 키·모델·한도도 함께
          넘어갑니다.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {admin && (
          <Link
            href="/teacher/teachers"
            className="rounded-xl border border-blue-200 bg-blue-50 p-6 shadow-sm hover:border-blue-400"
          >
            <h3 className="mb-1 font-semibold text-zinc-900">
              교사 관리 <span className="text-xs font-normal text-blue-600">관리자</span>
            </h3>
            <p className="text-sm text-zinc-500">
              교사 계정 만들기·삭제 · 누구나 교사 가입 열고 닫기 · 내 학생·자료 넘기기
            </p>
          </Link>
        )}

        {teaching && (
          <>
            {!profile.self_signup && <ArchivePublish />}
            <Link href="/teacher/students" className={card}>
              <h3 className="mb-1 font-semibold text-zinc-900">학생 관리</h3>
              <p className="text-sm text-zinc-500">
                명단(학년,반,번호,이름,비밀번호)으로 계정 일괄 생성 · 비밀번호 재설정
              </p>
            </Link>

            <Link href="/teacher/units" className={card}>
              <h3 className="mb-1 font-semibold text-zinc-900">단원·소단원 관리</h3>
              <p className="text-sm text-zinc-500">
                단원 만들기 · GeoGebra/자료/문제 활동 구성 · 공개 설정
              </p>
            </Link>

            <Link href="/teacher/progress" className={card}>
              <h3 className="mb-1 font-semibold text-zinc-900">진도 현황</h3>
              <p className="text-sm text-zinc-500">
                반별·활동별 완료율을 한눈에 보고, 막힌 지점 찾기
              </p>
            </Link>

            <Link href="/teacher/subjects" className={card}>
              <h3 className="mb-1 font-semibold text-zinc-900">교과 관리</h3>
              <p className="text-sm text-zinc-500">
                교과(공통수학2 등) 만들기 · 단원을 교과에 배치 · 공개 설정
              </p>
            </Link>

            <Link href="/teacher/authoring" className={card}>
              <h3 className="mb-1 font-semibold text-zinc-900">🛠 조작 활동 만들기</h3>
              <p className="text-sm text-zinc-500">
                만들고 싶은 화면을 말로 설명하면 AI 가 HTML 을 만들어 줍니다 · 내 API 키 사용
              </p>
            </Link>
          </>
        )}

        <Link href="/teacher/hands-on" className={card}>
          <h3 className="mb-1 font-semibold text-zinc-900">🖐 만져보는 수학</h3>
          <p className="text-sm text-zinc-500">
            {admin && !teaching
              ? "누구나 쓰는 공개 조작 자료 만들기·고치기·공개 설정"
              : "바로 쓰는 조작 자료 · 링크만 나눠 주거나(기록 없음) 내 소단원에 활동 한 화면으로 추가"}
          </p>
        </Link>

        {teaching && (
          <>
            <Link href="/teacher/export" className={card}>
              <h3 className="mb-1 font-semibold text-zinc-900">기록 다운로드</h3>
              <p className="text-sm text-zinc-500">
                학생·반·활동을 선택해 제출 기록을 CSV(엑셀)로 다운로드
              </p>
            </Link>

            <Link href="/teacher/ai-settings" className={card}>
              <h3 className="mb-1 font-semibold text-zinc-900">AI 설정</h3>
              <p className="text-sm text-zinc-500">
                내 API 키(OpenAI·Gemini·Claude) · 내 학생이 고를 모델 · 일일 한도 · 프롬프트 —
                내 학생의 AI 와 내 활동 만들기가 이 키를 씁니다
              </p>
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
