import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";

export const metadata: Metadata = {
  title: "우리 반 게시판",
  description: "학교 구글 계정으로 함께 쓰는 주제별 수업 게시판",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1f5c4a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- 앱 전체에서 쓰는 글꼴 */}
        <link href="https://fonts.googleapis.com/css2?family=Do+Hyeon&family=Gowun+Dodum&display=swap" rel="stylesheet" />
      </head>
      <body className="flex min-h-full flex-col bg-paper text-ink">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
