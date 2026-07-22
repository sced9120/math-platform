"use client";

import type { AiModelOption } from "@/components/student/activity-runner";

// 학생용 AI 모델 선택 드롭다운. 모델이 1개뿐이면 표시하지 않는다.
export default function ModelPicker({
  models,
  value,
  onChange,
}: {
  models: AiModelOption[];
  value: string;
  onChange: (modelId: string) => void;
}) {
  if (models.length <= 1) return null;
  return (
    <label className="flex items-center gap-2 text-xs text-zinc-500">
      AI 모델
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-zinc-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none"
      >
        {models.map((m) => (
          <option key={m.model_id} value={m.model_id}>
            {m.label}
          </option>
        ))}
      </select>
    </label>
  );
}
