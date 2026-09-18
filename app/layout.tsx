import type { Metadata, Viewport } from 'next'
import './globals.css'
import Nav from './Nav'
import { PetsProvider } from './PetsProvider'

const TITLE = '멍냥맵 - 반려 동물과 함께 할 수 있는 관광지, 핫플레이스를 한 눈에!'
const DESCRIPTION =
  '반려동물 동반 조건을 우리 아이 기준으로 판별하여 헛걸음을 사전 방지해주는 핫플레이스 맵 서비스. 데이터 출처: ⓒ한국관광공사'

/** 브라우저 탭·검색 결과·카카오톡 링크 미리보기에 뜨는 것 */
export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  openGraph: { title: TITLE, description: DESCRIPTION, siteName: '멍냥맵', locale: 'ko_KR', type: 'website' },
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
        {/* 프로필 버튼은 Nav 에, 판정은 각 화면에 — 같은 상태를 봐야 하므로 여기서 묶는다 */}
        <PetsProvider>
          <Nav />
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>{children}</div>
        </PetsProvider>
      </body>
    </html>
  )
}
