import PublicHeader from "@/components/public-header";

// 만져보는 수학 — 로그인 없이 누구나 연다 (proxy 에서 열어 둠)
export default function HandsOnLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-full flex-1 flex-col bg-zinc-50">
      <PublicHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
    </div>
  );
}
