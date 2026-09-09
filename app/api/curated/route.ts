import { NextResponse } from 'next/server'
import { hotplaces, needsReport, VISIT_PERIOD } from '@/lib/curate'

export const dynamic = 'force-dynamic'

/**
 * 큐레이션 목록. 배치가 받아둔 파일을 엮기만 하므로 KTO 호출이 없다.
 *   ?kind=hotplace  확실히 갈 수 있는 곳
 *   ?kind=needs     조건 정보가 부족해 제보가 필요한 곳
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const kind = searchParams.get('kind') ?? 'hotplace'
  const regnCd = searchParams.get('regnCd') ?? ''
  const sort = searchParams.get('sort') === 'visitors' ? 'visitors' : 'default'

  const items = kind === 'needs' ? needsReport() : hotplaces(regnCd || undefined, sort)
  // 집계 기간을 함께 보낸다 — 화면이 "언제 기준인지"를 밝히지 않으면
  // 오늘 붐비는 곳으로 읽힌다. 실제로는 한 달쯤 지난 집계다
  return NextResponse.json({ items, total: items.length, visitPeriod: VISIT_PERIOD })
}
