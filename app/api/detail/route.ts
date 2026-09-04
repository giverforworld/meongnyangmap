import { NextResponse } from 'next/server'
import { call } from '@/lib/kto'
import { clean } from '@/lib/openHours'
import type { Detail } from '@/lib/types'
import prebuilt from '../../../data/details.json'

export const dynamic = 'force-dynamic'

/**
 * 상세 패널 한 번에 필요한 정보를 모아 온다 — 소개글·홈페이지·영업시간·휴무일·전화·
 * 입장료·사진. 네 오퍼레이션을 병렬로 부르고 24시간 캐싱한다.
 *
 * 실측 채움률(타입당 12건 표본): 영업시간 41~100% · 휴무일 41~100% · 소개글 91~100%
 * · 홈페이지 25~91% · 추가사진 16~100% · 입장료 41~100%. 레포츠와 숙박은 비는 것이
 * 많으니 화면에서 '없으면 감추는' 방식으로 다뤄야 한다.
 */
const TTL = 24 * 60 * 60 * 1000
const cache = new Map<string, { at: number; detail: Detail }>()

/**
 * 일 배치가 받아둔 상세. 한 곳당 4콜이라 화면에서 매번 부르면 가장 무거운 지점이다.
 * 표에 없는 장소(쇼핑 등 배치 대상 밖)만 실시간으로 부른다.
 */
const FILE = (prebuilt as { details?: Record<string, Detail> }).details ?? {}

/** 타입마다 필드명이 다르다. 39 는 infocenterfood — service 가 붙지 않는다 */
const TEL: Record<string, string> = {
  '12': 'infocenter',
  '14': 'infocenterculture',
  '15': 'sponsor1tel',
  '28': 'infocenterleports',
  '32': 'infocenterlodging',
  '38': 'infocentershopping',
  '39': 'infocenterfood',
}
const TIME: Record<string, string> = {
  '12': 'usetime',
  '14': 'usetimeculture',
  '15': 'playtime',
  '28': 'usetimeleports',
  '32': 'checkintime',
  '38': 'opentime',
  '39': 'opentimefood',
}
const REST: Record<string, string> = {
  '12': 'restdate',
  '14': 'restdateculture',
  '28': 'restdateleports',
  '38': 'restdateshopping',
  '39': 'restdatefood',
}
const PARK: Record<string, string> = {
  '12': 'parking',
  '14': 'parkingculture',
  '15': 'parkingevent',
  '28': 'parkingleports',
  '32': 'parkinglodging',
  '38': 'parkingshopping',
  '39': 'parkingfood',
}

const EMPTY: Detail = {
  overview: '', homepage: '', usetime: '', restdate: '', parking: '',
  tels: [], extras: [], images: [],
}

/** 개요·홈페이지에 <a> 나 <br> 이 섞여 온다 */
function text(s?: string) {
  return clean((s ?? '').replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ')
}

/** 홈페이지 필드는 <a href="..."> 형태로 오는 경우가 많다 */
function href(s?: string) {
  const m = (s ?? '').match(/https?:\/\/[^\s"'<>]+/)
  return m ? m[0] : ''
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const contentId = searchParams.get('contentId') ?? ''
  const contentTypeId = searchParams.get('contentTypeId') ?? ''
  if (!contentId) {
    return NextResponse.json({ error: 'contentId 가 필요해요', detail: EMPTY }, { status: 400 })
  }

  const fromFile = FILE[contentId]
  if (fromFile) return NextResponse.json({ detail: fromFile, cached: true })

  const hit = cache.get(contentId)
  if (hit && Date.now() - hit.at < TTL) {
    return NextResponse.json({ detail: hit.detail, cached: true })
  }

  // 하나가 비어도 나머지는 보여준다 — 타입에 따라 아예 없는 정보가 있기 때문이다
  const safe = <T>(p: Promise<{ items: T[] }>) => p.then((r) => r.items).catch(() => [] as T[])

  try {
    const [common, intro, info, image] = await Promise.all([
      safe(call<Record<string, string>>('detailCommon2', { contentId })),
      contentTypeId
        ? safe(call<Record<string, string>>('detailIntro2', { contentId, contentTypeId }))
        : Promise.resolve([]),
      contentTypeId
        ? safe(call<Record<string, string>>('detailInfo2', { contentId, contentTypeId }))
        : Promise.resolve([]),
      safe(call<Record<string, string>>('detailImage2', { contentId, imageYN: 'Y' })),
    ])

    const c = common[0] ?? {}
    const i = intro[0] ?? {}

    const detail: Detail = {
      overview: text(c.overview),
      homepage: href(c.homepage),
      usetime: text(i[TIME[contentTypeId]]),
      restdate: text(i[REST[contentTypeId]]),
      parking: text(i[PARK[contentTypeId]]),
      // 한 필드에 번호가 여럿 들어오기도 한다 (개행·쉼표로 구분)
      tels: (i[TEL[contentTypeId]] ?? '')
        .split(/\n|,|<br\s*\/?>/i)
        .map((s) => s.trim())
        .filter(Boolean),
      extras: info
        .map((x) => ({ name: text(x.infoname), text: text(x.infotext) }))
        .filter((x) => x.name && x.text),
      images: image
        .map((x) => ({ url: x.originimgurl ?? '', copyright: x.cpyrhtDivCd ?? '' }))
        .filter((x) => x.url),
    }

    cache.set(contentId, { at: Date.now(), detail })
    return NextResponse.json({ detail, cached: false })
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message, detail: EMPTY }, { status: 500 })
  }
}
