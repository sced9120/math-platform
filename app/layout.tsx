import type { Metadata } from "next";
import "./globals.css";

// 웹폰트(next/font/google)를 쓰지 않는다.
//  - 본문은 어차피 한글이라 Geist 가 적용되지 않고(라틴 전용) 시스템 폰트로 대체되었다.
//  - 빌드·개발 서버가 Google Fonts 를 받아오지 못하면 그대로 멈추는 문제가 있었다.
// 폰트 스택은 globals.css 에서 시스템 폰트로 지정한다.

export const metadata: Metadata = {
  title: "수학 학습 플랫폼",
  description: "고등학교 수학 학습 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
