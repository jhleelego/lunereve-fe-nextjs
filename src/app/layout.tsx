import type { Metadata } from "next";
import { Noto_Sans_KR, Cormorant_Garamond } from "next/font/google";
import LayoutShell from "@/components/LayoutShell";
import "./globals.css";

const notoSansKR = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  subsets: ["latin"],
  weight: ["300", "400", "500"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin"],
  weight: ["300", "400"],
});

export const metadata: Metadata = {
  title: "륀레브 | Lunereve",
  description: "품질 좋은 생활용품 브랜드, 륀레브(Lunereve) 공식 상품 소개",
  keywords: ["륀레브", "Lunereve", "생활용품", "홈리빙"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${notoSansKR.variable} ${cormorant.variable} h-full scroll-smooth`}
      suppressHydrationWarning
    >
      <body
        className="min-h-full flex flex-col bg-white font-sans text-neutral-800 antialiased"
        suppressHydrationWarning
      >
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
