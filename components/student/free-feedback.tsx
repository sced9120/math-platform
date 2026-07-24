"use client";

import { useState } from "react";
import FeedbackPanel from "@/components/student/feedback-panel";
import type { AiModelOption } from "@/components/student/activity-runner";

// 자유 문제 첨삭 래퍼 — 동의 상태만 클라이언트에서 관리
export default function FreeFeedback({
  aiConsented,
  models,
  dailyLimit,
}: {
  aiConsented: boolean;
  models: AiModelOption[];
  dailyLimit: number;
}) {
  const [consented, setConsented] = useState(aiConsented);
  return (
    <FeedbackPanel
      activityId={null}
      consented={consented}
      onConsent={() => setConsented(true)}
      models={models}
      dailyLimit={dailyLimit}
    />
  );
}
