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

  // ── ② 동반 조건 — 전 타입. 개발계정(일 1,000건) 때는 쇼핑 8,647건을 뒤로 미뤘지만,
  //    2026-09-08 운영계정 승인으로 한도가 10만 건이 되어 그럴 이유가 없어졌다.
  const prev = readJson<any>('petRules.json', { rules: {} })
  const rules: Record<string, PetRules | null> = prev.rules ?? {}

  const targets = places.map((p) => p.contentid).filter((id) => !(id in rules))

  console.log(
    `\n동반 조건: 대상 ${places.length.toLocaleString()}건 ` +
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
  //    조건과 마찬가지로 전 타입을 받는다. 한도에 걸리면 거기까지 저장한다.
  const prevD = readJson('details.json', { details: {} })
  const details: Record<string, unknown> = prevD.details ?? {}
  const dTargets = places.filter((p) => !(p.contentid in details))

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

  // ── ④ 캠핑장 — 고캠핑 서비스(GoCamping)는 전국 3,115곳을 1콜에 준다.
  //    반려동물 동반 여부(animalCmgCl)가 이미 필드로 들어 있어 따로 조회할 게 없다.
  //    반려동물 동반여행 서비스의 숙박은 107곳뿐이라, 캠핑이 그 빈자리를 메운다.
  console.log('\n캠핑장을 받는 중…')
  const { items: camps } = await call<any>(
    'basedList',
    { numOfRows: 3500, pageNo: 1 },
    'GoCamping'
  )
  if (camps.length === 0) throw new Error('캠핑장 목록이 비어 있어요')

  // 화면이 쓰는 필드만 남긴다. 원본은 한 곳당 81필드다
  const camping = camps.map((c) => ({
    id: String(c.contentId ?? ''),
    name: c.facltNm ?? '',
    addr: c.addr1 ?? '',
    doNm: c.doNm ?? '',
    sigunguNm: c.sigunguNm ?? '',
    mapx: Number(c.mapX) || 0,
    mapy: Number(c.mapY) || 0,
    image: c.firstImageUrl ?? '',
    // 해변·산·숲·강 — 어떤 곳인지 한눈에 보여주는 값
    lctCl: c.lctCl ?? '',
    // 일반야영장·글램핑·카라반
    induty: c.induty ?? '',
    tel: c.tel ?? '',
    homepage: c.homepage ?? '',
    resveCl: c.resveCl ?? '',
    intro: (c.intro ?? '').replace(/\s+/g, ' ').trim().slice(0, 160),
    /** '가능' · '가능(소형견)' · '불가능' · 빈값. 판정은 화면에서 한다 */
    animal: (c.animalCmgCl ?? '').trim(),
  }))

  const yes = camping.filter((c) => /가능/.test(c.animal) && !/불가/.test(c.animal)).length
  console.log(`  ${camping.length.toLocaleString()}곳 · 반려동물 동반 가능 ${yes.toLocaleString()}곳`)
  save('camping.json', { collectedAt: new Date().toISOString(), camping })

  // ── ⑤ 지역 방문자 수 — 관광 빅데이터(DataLabService).
  //    "요즘 어디에 사람이 몰리나"를 아는 유일한 공개 데이터다. 다만 **지역 단위**이고
  //    반려동물 구분이 없다 — 개별 장소의 인기도가 아니라는 걸 화면 문구가 지켜야 한다.
  console.log('\n지역 방문자 수를 받는 중…')

  const ymd = (d: Date) => d.toISOString().slice(0, 10).replace(/-/g, '')
  const daysAgo = (n: number) => {
    const d = new Date()
    d.setDate(d.getDate() - n)
    return d
  }

  // 집계가 한 달 남짓 늦게 올라온다. 어디까지 있는지 먼저 짚어야 헛되이 큰 범위를
  // 요청하지 않는다 — 하루가 800행이라 범위를 넓히면 응답이 수 MB 로 불어난다.
  let endAt = 0
  for (const back of [20, 30, 40, 50, 60, 75]) {
    const probe = ymd(daysAgo(back))
    const { totalCount } = await call<any>('locgoRegnVisitrDDList', {
      numOfRows: 1, pageNo: 1, startYmd: probe, endYmd: probe,
    }, 'DataLabService')
    if (totalCount > 0) { endAt = back; break }
  }

  if (endAt === 0) {
    console.log('  최근 75일 안에 집계된 날이 없어요 — 건너뜁니다')
  } else {
    const to = ymd(daysAgo(endAt))
    const from = ymd(daysAgo(endAt + 29))
    const { items: rows } = await call<any>('locgoRegnVisitrDDList', {
      numOfRows: 40000, pageNo: 1, startYmd: from, endYmd: to,
    }, 'DataLabService')

    // 외지인(touDivCd=2)만 센다. 현지인은 생활 인구라 '찾아간 곳'과 다르고,
    // 외국인은 반려동물 동반여행과 관계가 옅다.
    const sum = new Map<string, { name: string; n: number }>()
    for (const r of rows) {
      if (String(r.touDivCd) !== '2') continue
      const code = String(r.signguCode)
      const cur = sum.get(code) ?? { name: r.signguNm ?? '', n: 0 }
      cur.n += Number(r.touNum) || 0
      sum.set(code, cur)
    }

    const regions = [...sum.entries()]
      .map(([code, v]) => ({ code, name: v.name, visitors: Math.round(v.n) }))
      .sort((a, b) => b.visitors - a.visitors)
      .map((r, i) => ({ ...r, rank: i + 1 }))

    console.log(`  ${rows.length.toLocaleString()}행 → 시군구 ${regions.length}곳 (${from}~${to})`)
    console.log(`  1위 ${regions[0]?.name} · 2위 ${regions[1]?.name} · 3위 ${regions[2]?.name}`)
    save('visitors.json', { collectedAt: new Date().toISOString(), from, to, regions })

    // ── ⑥ 관광지 집중률 — 조회일 기준 향후 30일 예측(TatsCnctrRateService).
    //    ㈜케이티 이동통신 데이터 기반이고, 가장 붐비는 시기를 100 으로 본 **상대값**이다.
    //    방문자 수가 아니라 "얼마나 몰리나"라서 화면 문구가 그 선을 지켜야 한다.
    //
    //    지역 방문자 수와 달리 **관광지 단위**다. 다만 contentid 가 아니라 이름으로만
    //    오므로 시군구+이름으로 맞춘다. 실측 매칭률은 '갈 만한 곳' 1,043곳 중 38.6%.
    console.log('\n관광지 집중률을 받는 중…')

    const norm = (s: string) =>
      String(s ?? '').replace(/[\s()·\-]/g, '').toLowerCase()
    const byName = new Map<string, string>()
    for (const p of places) {
      if (p.contenttypeid === '38') continue
      byName.set(`${p.regnCd}${p.signguCd}|${norm(p.title)}`, p.contentid)
    }

    const crowd: Record<string, { ymd: string; rate: number }[]> = {}
    let scanned = 0
    for (let i = 0; i < regions.length; i += POOL) {
      await Promise.all(
        regions.slice(i, i + POOL).map(async (r) => {
          try {
            const { items } = await call<any>(
              'tatsCnctrRatedList',
              { numOfRows: 3000, pageNo: 1, areaCd: r.code.slice(0, 2), signguCd: r.code },
              'TatsCnctrRateService'
            )
            for (const x of items) {
              const id = byName.get(`${r.code}|${norm(x.tAtsNm)}`)
              if (!id) continue
              ;(crowd[id] ??= []).push({ ymd: x.baseYmd, rate: Number(x.cnctrRate) || 0 })
            }
          } catch {
            // 시군구 하나가 실패해도 나머지는 받는다
          }
          scanned++
        })
      )
      process.stdout.write(`\r  ${scanned}/${regions.length}`)
    }
    process.stdout.write('\r')

    // 날짜순으로 정렬해 둔다 — 화면이 "오늘부터 며칠"을 그대로 잘라 쓸 수 있게
    for (const id of Object.keys(crowd)) {
      crowd[id].sort((a, b) => a.ymd.localeCompare(b.ymd))
    }

    const days = Object.values(crowd)[0]?.length ?? 0
    console.log(`  시군구 ${scanned}곳 조회 → 우리 장소 ${Object.keys(crowd).length}곳 매칭 (${days}일치)`)
    save('crowd.json', { collectedAt: new Date().toISOString(), crowd })
  }
}

main().catch((e) => {
  console.error(`\n실패: ${(e as Error).message}`)
  process.exit(1)
})
