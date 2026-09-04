import { NextResponse } from 'next/server'
import { catalog } from '@/lib/catalog'

export const dynamic = 'force-dynamic'

/**
 * 좌표 색인 — [contentid, 경도, 위도] 만 담은 경량 목록.
 *
 * '내 주변'을 위해 존재한다. 사용자 좌표를 서버로 보내면 저장 여부와 무관하게
 * 위치기반서비스사업자 신고 대상이 되므로(공모전 공지 FAQ), 거리 계산은 브라우저에서 한다.
 * 그러려면 브라우저가 후보 좌표를 갖고 있어야 하는데, 전국 목록 전체(3.5MB)를 내려보내는
 * 대신 좌표만 추려 보낸다. 브라우저가 가까운 contentid 를 고르면 그것만 다시 받아간다.
 */
export async function GET() {
  try {
    const all = await catalog()
    // 배열 형태로 보내 키 이름 반복을 없앤다 — 객체로 담으면 3배 커진다
    const coords = all
      .filter((p) => p.mapx && p.mapy)
      .map((p) => [p.contentid, p.mapx, p.mapy])
    return NextResponse.json({ coords })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, coords: [] }, { status: 500 })
  }
}
