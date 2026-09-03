import { NextResponse } from 'next/server'
import { call } from '@/lib/kto'

export const dynamic = 'force-dynamic'

/** 전화번호 필드명이 콘텐츠 타입마다 다르다. 39 는 infocenterfood — service 가 붙지 않는다 */
const TEL_FIELD: Record<string, string> = {
  '12': 'infocenter',
  '14': 'infocenterculture',
  '28': 'infocenterleports',
  '32': 'infocenterlodging',
  '39': 'infocenterfood',
}

const TTL = 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; tels: string[] }>()

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const contentId = searchParams.get('contentId') ?? ''
  const contentTypeId = searchParams.get('contentTypeId') ?? ''

  const field = TEL_FIELD[contentTypeId]
  if (!contentId || !field) {
    return NextResponse.json({ error: '지원하지 않는 콘텐츠 타입이에요', tels: [] }, { status: 400 })
  }

  const hit = cache.get(contentId)
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ tels: hit.tels, cached: true })
  }

  try {
    const { items } = await call<Record<string, string>>('detailIntro2', {
      contentId,
      contentTypeId,
    })

    // 한 필드에 번호가 여럿 들어오기도 한다 (개행·쉼표로 구분)
    const tels = (items[0]?.[field] ?? '')
      .split(/\n|,/)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    cache.set(contentId, { at: Date.now(), tels })
    return NextResponse.json({ tels, cached: false })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, tels: [] }, { status: 500 })
  }
}
