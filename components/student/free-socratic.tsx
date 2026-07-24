"use client";

import { useState } from "react";
import SocraticChat from "@/components/student/socratic-chat";
import type { AiModelOption } from "@/components/student/activity-runner";

// 자유 질문 모드 래퍼 — 동의 상태만 클라이언트에서 관리
export default function FreeSocratic({
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
    <SocraticChat
      activityId={null}
      consented={consented}
      onConsent={() => setConsented(true)}
      models={models}
      dailyLimit={dailyLimit}
    />
  );
}
