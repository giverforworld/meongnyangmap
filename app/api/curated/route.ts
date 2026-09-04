import { NextResponse } from 'next/server'
import { hotplaces, needsReport } from '@/lib/curate'

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

  const items = kind === 'needs' ? needsReport() : hotplaces(regnCd || undefined)
  return NextResponse.json({ items, total: items.length })
}
