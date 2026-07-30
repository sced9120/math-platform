import Link from "next/link";

// 체험판임을 항상 알려 주는 띠. 실제 수업용 사이트와 헷갈리지 않게 한다.
export default function DemoBanner() {
  return (
    <div className="border-b border-amber-200 bg-amber-50">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm text-amber-900">
        <span className="rounded-full bg-amber-200 px-2 py-0.5 text-xs font-bold">체험판</span>
        <span>
          로그인 없이 <b>둘러보기만</b> 하는 화면입니다. 작성한 내용은 <b>저장되지 않습니다.</b>
        </span>
        <Link
          href="https://github.com/sced9120/math-platform"
          className="ml-auto shrink-0 font-medium underline"
        >
          내 학교에 설치하기 →
        </Link>
      </div>
    </div>
  );
}
