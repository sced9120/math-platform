import SettingsManager from "@/components/teacher/settings-manager";

// 내 AI 설정 (교사마다 따로): 내 API 키 + 내 학생이 고를 모델 + 일일 한도
// 권한 가드는 teacher layout 이 처리한다. API 는 언제나 "내 것"만 다룬다.
export default function AiSettingsPage() {
  return <SettingsManager />;
}
