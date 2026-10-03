import PromptsManager from "@/components/teacher/prompts-manager";

// 내 AI 프롬프트 (교사마다 따로) — 내 학생의 문답·첨삭 AI 성격·규칙
// 권한 가드는 teacher layout 이 처리한다. API 는 언제나 "내 것"만 다룬다.
export default function PromptsPage() {
  return <PromptsManager />;
}
