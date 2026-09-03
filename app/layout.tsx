import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '멍냥맵 — 우리 아이 기준 반려동물 동반 판정',
  description:
    '반려동물 동반 조건을 우리 아이 기준으로 판정해 헛걸음을 막아주는 지도 서비스. 출처: ⓒ한국관광공사',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;700&family=Jua&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  )
}
