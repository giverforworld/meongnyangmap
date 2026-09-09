import { NextResponse } from 'next/server'
import type { Camp } from '@/lib/camping'
import file from '../../../../data/camping.json'

export const dynamic = 'force-dynamic'

/**
 * 좌표 색인 — [id, 경도, 위도] 만 담은 경량 목록.
 *
 * 캠핑 '가까운 순'을 위해 존재한다. 사용자 좌표를 서버로 보내면 저장 여부와 무관하게
 * 위치기반서비스사업자 신고 대상이 되므로(공모전 공지 FAQ), 거리 계산은 브라우저에서 한다.
 * 그러려면 브라우저가 후보 좌표를 갖고 있어야 하는데, 목록 전체(1.9MB)를 내려보내는
 * 대신 좌표만 추려 보낸다. 브라우저가 가까운 id 를 고르면 그것만 다시 받아간다.
 *
 * 지도 쪽 /api/places/coords 와 같은 구조다.
 */
const CAMPS: Camp[] = (file as { camping?: Camp[] }).camping ?? []

export async function GET() {
  // 배열 형태로 보내 키 이름 반복을 없앤다 — 객체로 담으면 3배 커진다
  const coords = CAMPS.filter((c) => c.mapx && c.mapy).map((c) => [c.id, c.mapx, c.mapy])
  return NextResponse.json({ coords })
}
