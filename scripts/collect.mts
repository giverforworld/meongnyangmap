/**
 * 전국 목록과 동반 조건을 미리 받아 data/ 에 저장한다.
 *
 *   npm run collect
 *
 * detailPetTour2 는 장소당 1콜이라 개발계정(일 1,000건)으로는 이틀 걸린다.
 * 한도에 걸리면 받은 데까지 저장하고 멈추므로, 다음 날 다시 실행하면 이어서 받는다.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA = path.join(ROOT, 'data')

// lib/kto 가 import 시점에 환경변수를 읽으므로 먼저 채워 넣는다
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

/** petTourSyncList2 는 10000 까지만 응답한다. 99999 는 오지 않는다 */
const MAX_ROWS = 10000
const POOL = 4

function save(file: string, data: unknown) {
  fs.writeFileSync(path.join(DATA, file), JSON.stringify(data), 'utf8')
  const kb = Math.round(fs.statSync(path.join(DATA, file)).size / 1024)
  console.log(`  → data/${file} (${kb.toLocaleString()}KB)`)
}

/** 한도 초과는 여기서 멈춰야 한다 — 계속 두드려봐야 실패만 쌓인다 */
const isQuota = (e: unknown) =>
  /LIMITED_NUMBER_OF_SERVICE_REQUESTS|요청제한/.test(String(e))

function readJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8'))
  } catch {
    return fallback
  }
}

/** 타입마다 필드명이 다르다. app/api/detail 과 같은 표를 쓴다 */
const TEL: Record<string, string> = { '12':'infocenter','14':'infocenterculture','15':'sponsor1tel','28':'infocenterleports','32':'infocenterlodging','38':'infocentershopping','39':'infocenterfood' }
const TIME: Record<string, string> = { '12':'usetime','14':'usetimeculture','15':'playtime','28':'usetimeleports','32':'checkintime','38':'opentime','39':'opentimefood' }
const REST: Record<string, string> = { '12':'restdate','14':'restdateculture','28':'restdateleports','38':'restdateshopping','39':'restdatefood' }
const PARK: Record<string, string> = { '12':'parking','14':'parkingculture','15':'parkingevent','28':'parkingleports','32':'parkinglodging','38':'parkingshopping','39':'parkingfood' }

const strip = (s?: string) =>
  (s ?? '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').trim()
const href = (s?: string) => (s ?? '').match(/https?:\/\/[^\s"'<>]+/)?.[0] ?? ''

/** 상세 4종을 병렬로 받아 화면이 쓰는 모양으로 합친다 */
async function fetchDetail(call: any, contentId: string, contentTypeId: string) {
  const safe = (p: Promise<{ items: any[] }>) => p.then((r) => r.items).catch(() => [] as any[])
  const [common, intro, info, image] = await Promise.all([
    safe(call('detailCommon2', { contentId })),
    safe(call('detailIntro2', { contentId, contentTypeId })),
    safe(call('detailInfo2', { contentId, contentTypeId })),
    safe(call('detailImage2', { contentId, imageYN: 'Y' })),
  ])
  const c = common[0] ?? {}
  const i = intro[0] ?? {}
  return {
    overview: strip(c.overview),
    homepage: href(c.homepage),
    usetime: strip(i[TIME[contentTypeId]]),
    restdate: strip(i[REST[contentTypeId]]),
    parking: strip(i[PARK[contentTypeId]]),
    tels: (i[TEL[contentTypeId]] ?? '').split(/\n|,|<br\s*\/?>/i).map((x: string) => x.trim()).filter(Boolean),
    extras: info.map((x: any) => ({ name: strip(x.infoname), text: strip(x.infotext) })).filter((x: any) => x.name && x.text),
    images: image.map((x: any) => ({ url: x.originimgurl ?? '', copyright: x.cpyrhtDivCd ?? '' })).filter((x: any) => x.url),
  }
}

type PetRules = import('../lib/types.js').PetRules
type PetTourRaw = import('../lib/types.js').PetTourRaw

async function main() {
  const { call } = await import('../lib/kto.js')
  const { parseRules } = await import('../lib/petTour.js')

  // ── ① 전국 목록
  console.log('전국 목록을 받는 중… (약 7초)')
  const { items } = await call<any>('petTourSyncList2', {
    showflag: 1,
    numOfRows: MAX_ROWS,
    pageNo: 1,
  })
  if (items.length === 0) throw new Error('전국 목록이 비어 있어요 — 잠시 후 다시 시도해주세요')

  // 화면에 쓰는 필드만 남긴다. 원본 6.9MB 가 3분의 1로 줄어든다
  const places = items.map((r) => ({
    contentid: String(r.contentid),
    contenttypeid: String(r.contenttypeid),
    title: r.title ?? '',
    addr1: r.addr1 ?? '',
    mapx: Number(r.mapx) || 0,
    mapy: Number(r.mapy) || 0,
    firstimage: r.firstimage ?? '',
    lclsSystm1: r.lclsSystm1 ?? '',
    lclsSystm2: r.lclsSystm2 ?? '',
    lclsSystm3: r.lclsSystm3 ?? '',
    regnCd: String(r.lDongRegnCd ?? ''),
    signguCd: String(r.lDongSignguCd ?? ''),
  }))
  console.log(`  ${places.length.toLocaleString()}건`)
  save('places.json', { collectedAt: new Date().toISOString(), places })

  // ── ② 동반 조건 — 쇼핑(38)은 사후면세점이라 뒤로 미룬다
  const prev = readJson<any>('petRules.json', { rules: {} })
  const rules: Record<string, PetRules | null> = prev.rules ?? {}

  const targets = places
    .filter((p) => p.contenttypeid !== '38')
    .map((p) => p.contentid)
    .filter((id) => !(id in rules))

  console.log(
    `\n동반 조건: 대상 ${(places.length - places.filter((p) => p.contenttypeid === '38').length).toLocaleString()}건 ` +
      `· 이미 받은 것 ${Object.keys(rules).length.toLocaleString()}건 · 이번에 받을 것 ${targets.length.toLocaleString()}건`
  )

  let done = 0
  let stopped = false

  for (let i = 0; i < targets.length && !stopped; i += POOL) {
    const batch = targets.slice(i, i + POOL)
    const got = await Promise.all(
      batch.map(async (id) => {
        try {
          const { items } = await call<PetTourRaw>('detailPetTour2', {
            contentId: id,
            numOfRows: 10,
            pageNo: 1,
          })
          return { id, rules: items[0] ? parseRules(items[0]) : null }
        } catch (e) {
          if (isQuota(e)) {
            stopped = true
            return null
          }
          // 개별 실패는 건너뛴다 — 다음 실행에서 다시 시도된다
          return null
        }
      })
    )

    for (const g of got) {
      if (!g) continue
      rules[g.id] = g.rules
      done++
    }

    process.stdout.write(`\r  ${done.toLocaleString()} / ${targets.length.toLocaleString()}`)
  }

  process.stdout.write('\r')
  const total = Object.keys(rules).length
  const withData = Object.values(rules).filter(Boolean).length

  if (stopped) {
    console.log(`  일일 한도에 걸려 여기까지 받았어요. 내일 다시 실행하면 이어서 받습니다.`)
  }
  console.log(`  이번에 ${done.toLocaleString()}건 · 누적 ${total.toLocaleString()}건 (조건 있는 곳 ${withData.toLocaleString()}건)`)
  save('petRules.json', { collectedAt: new Date().toISOString(), rules })

  const left = targets.length - done
  console.log(left > 0 ? `  남은 것 ${left.toLocaleString()}건 — 다시 실행하면 이어서 받아요.` : '  전부 받았어요.')

  // ── ③ 상세 정보 — 영업시간·휴무일·전화·소개글·홈페이지·입장료·사진
  //    한 곳당 4콜(detailCommon2/Intro2/Info2/Image2)이라 조건보다 4배 무겁다.
  //    조건과 마찬가지로 쇼핑은 뒤로 미루고, 한도에 걸리면 거기까지 저장한다.
  const prevD = readJson('details.json', { details: {} })
  const details: Record<string, unknown> = prevD.details ?? {}
  const dTargets = places
    .filter((p) => p.contenttypeid !== '38')
    .filter((p) => !(p.contentid in details))

  console.log(`\n상세 정보: 이번에 받을 것 ${dTargets.length.toLocaleString()}건 (한 곳당 4콜)`)

  let dDone = 0
  let dStopped = false

  for (let i = 0; i < dTargets.length && !dStopped; i += POOL) {
    const batch = dTargets.slice(i, i + POOL)
    const got = await Promise.all(
      batch.map(async (p) => {
        try {
          return { id: p.contentid, detail: await fetchDetail(call, p.contentid, p.contenttypeid) }
        } catch (e) {
          if (isQuota(e)) dStopped = true
          return null
        }
      })
    )
    for (const g of got) {
      if (!g) continue
      details[g.id] = g.detail
      dDone++
    }
    process.stdout.write(`\r  ${dDone.toLocaleString()} / ${dTargets.length.toLocaleString()}`)
  }

  process.stdout.write('\r')
  if (dStopped) console.log('  일일 한도에 걸려 여기까지 받았어요.')
  console.log(`  이번에 ${dDone.toLocaleString()}건 · 누적 ${Object.keys(details).length.toLocaleString()}건`)
  save('details.json', { collectedAt: new Date().toISOString(), details })
}

main().catch((e) => {
  console.error(`\n실패: ${(e as Error).message}`)
  process.exit(1)
})
