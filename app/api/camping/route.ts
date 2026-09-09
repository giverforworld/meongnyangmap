import { NextResponse } from 'next/server'
import { judgeCamp, normalizeRegion, regionsOf, type Camp, type CampState } from '@/lib/camping'
import type { Pet, PetSize } from '@/lib/types'
import file from '../../../data/camping.json'

export const dynamic = 'force-dynamic'

/**
 * 캠핑장 목록 — 고캠핑 서비스에서 배치가 받아둔 3,115곳.
 *
 * 판정을 서버에서 하는 이유는 크기 때문이다. 전체를 내려보내면 1.2MB 인데,
 * 그중 절반은 아예 동반 불가라 화면에 뜨지도 않는다. 우리 아이 기준으로 거른 뒤
 * 한 페이지 분량만 보낸다 — 지도 목록(/api/places)이 서울 3,170곳을 통째로
 * 보내며 1MB 를 쓰는 것과 같은 실수를 여기서 반복하지 않는다.
 *
 * 크기(size)는 판정에 필요한 값일 뿐 개인정보가 아니다. 위치는 여전히 받지 않는다.
 */
const CAMPS: Camp[] = (file as { camping?: Camp[] }).camping ?? []
const COLLECTED_AT: string = (file as { collectedAt?: string }).collectedAt ?? ''

const PAGE = 60

/** 판정에 쓰는 최소한의 프로필. 이름·무게는 사유 문구에만 쓰인다 */
function petFrom(size: PetSize, name: string): Pet {
  const label = size === 'small' ? '소형견' : size === 'medium' ? '중형견' : '대형견'
  return {
    key: 'q', name, breed: '', kg: 0, emoji: '🐶',
    size, sizeLabel: label,
    hasCage: false, hasMuzzle: false, isDangerous: false,
  }
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const region = (searchParams.get('do') ?? '').trim()
  const q = (searchParams.get('q') ?? '').trim().toLowerCase()
  const tag = (searchParams.get('tag') ?? '').trim()
  const raw = searchParams.get('size')
  const size: PetSize = raw === 'medium' || raw === 'large' ? raw : 'small'
  const petName = (searchParams.get('petName') ?? '우리 아이').slice(0, 20)
  const limit = Math.min(Number(searchParams.get('limit')) || PAGE, 200)

  const pet = petFrom(size, petName)

  // 지역·검색·유형으로 먼저 좁힌 뒤 판정한다
  let list = CAMPS
  if (region) list = list.filter((c) => normalizeRegion(c.doNm) === region)
  if (tag) list = list.filter((c) => c.lctCl.includes(tag))
  if (q) {
    list = list.filter(
      (c) => c.name.toLowerCase().includes(q) || c.addr.toLowerCase().includes(q)
    )
  }

  // 화면에도 정규화한 이름으로 보낸다 — 칩은 '강원특별자치도'인데 카드만
  // '강원도'로 뜨면 같은 곳이 다르게 읽힌다
  const judged = list.map((c) => ({
    ...c,
    doNm: normalizeRegion(c.doNm),
    j: judgeCamp(c.animal, pet),
  }))

  // 동반 불가는 목록에서 뺀다. 숨겼다는 사실은 숫자로 알린다
  const visible = judged.filter((c) => c.j.state !== 'no')
  const hidden = judged.length - visible.length

  // 확실한 곳을 먼저, 그다음 사진 있는 곳, 그다음 이름순
  const rank = (s: CampState) => (s === 'ok' ? 0 : 1)
  visible.sort(
    (a, b) =>
      rank(a.j.state) - rank(b.j.state) ||
      (b.image ? 1 : 0) - (a.image ? 1 : 0) ||
      a.name.localeCompare(b.name, 'ko')
  )

  return NextResponse.json({
    camps: visible.slice(0, limit),
    total: visible.length,
    hidden,
    okCount: visible.filter((c) => c.j.state === 'ok').length,
    // 칩에 쓸 숫자는 지역 필터를 걸기 전 기준이어야 고를 수 있다
    regions: regionsOf(CAMPS),
    collectedAt: COLLECTED_AT,
  })
}
