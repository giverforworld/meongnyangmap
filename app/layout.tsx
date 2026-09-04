import type { Metadata, Viewport } from 'next'
import './globals.css'
import Nav from './Nav'

export const metadata: Metadata = {
  title: '멍냥맵 — 반려동물과 갈 곳을 찾는 가장 확실한 방법',
  description:
    '반려동물 동반 조건을 우리 아이 기준으로 판정해 헛걸음을 막아주는 지도 서비스. 출처: ⓒ한국관광공사',
}

/** 밖에서 폰으로 쓰는 서비스라 모바일 폭에 맞춰 그린다 */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
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
      <body style={{ display: 'flex', flexDirection: 'column', height: '100dvh', overflow: 'hidden' }}>
        <Nav />
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
      </body>
    </html>
  )
}
