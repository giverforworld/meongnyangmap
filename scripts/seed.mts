/**
 * 한국관광공사 API 13종을 Supabase 에 적재한다.
 *
 *   npm run seed              # 전부
 *   npm run seed -- places    # 특정 단계만 (places | rules | details | codes)
 *
 * 데이터를 뜯어보며 인사이트를 찾는 게 목적이라 **원본 응답을 통째로(raw jsonb) 함께
 * 넣는다.** 정규화한 컬럼만 두면 나중에 원본을 되짚을 방법이 없다.
 *
 * 이미 받아둔 data/*.json 이 있으면 그걸 쓰고, 없는 것만 API 를 부른다.
 * 한도에 걸리면 거기까지 넣고 멈춘다 — 다시 실행하면 이어서 받는다.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
const DATA = path.join(ROOT, 'data')

for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    '.env.local 에 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 필요해요.\n' +
      '  Supabase 대시보드 → Project Settings → API Keys 에서 확인할 수 있어요.\n' +
      '  service_role 키는 RLS 를 우회하므로 절대 프론트엔드에 넣지 마세요.'
  )
  process.exit(1)
}

const MAX_ROWS = 10000
const POOL = 4
const CHUNK = 500

const isQuota = (e: unknown) => /LIMITED_NUMBER_OF_SERVICE_REQUESTS|요청제한/.test(String(e))
const readJson = <T,>(f: string, fb: T): T => {
  try {
    return JSON.parse(fs.readFileSync(path.join(DATA, f), 'utf8'))
  } catch {
    return fb
  }
}

/** PostgREST 로 upsert. 500행씩 끊어 보낸다 */
async function upsert(table: string, rows: any[], onConflict: string) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const slice = rows.slice(i, i + CHUNK)
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?on_conflict=${encodeURIComponent(onConflict)}`,
      {
        method: 'POST',
        headers: {
          apikey: SERVICE_KEY!,
          Authorization: `Bearer ${SERVICE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=minimal',
        },
        body: JSON.stringify(slice),
      }
    )
    if (!res.ok) throw new Error(`${table} 적재 실패 (${res.status}): ${(await res.text()).slice(0, 300)}`)
    process.stdout.write(`\r  ${table}  ${Math.min(i + CHUNK, rows.length).toLocaleString()} / ${rows.length.toLocaleString()}`)
  }
  process.stdout.write('\r')
  console.log(`  ${table}  ${rows.length.toLocaleString()}행 완료`)
}

async function logRun(op: string, rows: number, calls: number, ok: boolean, message = '') {
  await fetch(`${SUPABASE_URL}/rest/v1/sync_runs`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify([
      { operation: op, rows, api_calls: calls, ok, message, finished_at: new Date().toISOString() },
    ]),
  }).catch(() => {})
}

async function main() {
  const only = process.argv.slice(2).filter((a) => !a.startsWith('-'))
  const want = (step: string) => only.length === 0 || only.includes(step)

  const { call, ALL } = await import('../lib/kto.js')
  const { parseRules } = await import('../lib/petTour.js')
  const { CONTENT_TYPES } = await import('../lib/kto.js')

  // ── ① 장소 목록
  let places: any[] = readJson<any>('places.json', { places: [] }).places ?? []
  if (want('places')) {
    if (places.length === 0) {
      console.log('전국 목록을 받는 중… (약 7초)')
      const { items } = await call<any>('petTourSyncList2', { showflag: 1, numOfRows: MAX_ROWS, pageNo: 1 })
      places = items
      await logRun('petTourSyncList2', items.length, 1, true)
    } else {
      console.log(`전국 목록 — data/places.json 에서 ${places.length.toLocaleString()}건`)
    }
    await upsert(
      'places',
      places.map((r: any) => ({
        contentid: String(r.contentid),
        contenttypeid: String(r.contenttypeid),
        cat: (CONTENT_TYPES as any)[Number(r.contenttypeid)] ?? '기타',
        title: r.title ?? '',
        addr1: r.addr1 ?? '',
        mapx: Number(r.mapx) || null,
        mapy: Number(r.mapy) || null,
        firstimage: r.firstimage ?? '',
        lcls_systm1: r.lclsSystm1 ?? '',
        lcls_systm2: r.lclsSystm2 ?? '',
        lcls_systm3: r.lclsSystm3 ?? '',
        regn_cd: String(r.lDongRegnCd ?? r.regnCd ?? ''),
        signgu_cd: String(r.lDongSignguCd ?? r.signguCd ?? ''),
        createdtime: r.createdtime ?? null,
        modifiedtime: r.modifiedtime ?? null,
        showflag: r.showflag ?? null,
        raw: r,
      })),
      'contentid'
    )
  }

  // ── ② 동반 조건 — 이미 받아둔 것부터, 없는 것만 호출
  if (want('rules')) {
    const saved: Record<string, any> = readJson<any>('petRules.json', { rules: {} }).rules ?? {}
    const targets = places.filter((p: any) => String(p.contenttypeid) !== '38')
    const missing = targets.filter((p: any) => !(String(p.contentid) in saved))
    console.log(`\n동반 조건 — 저장된 것 ${Object.keys(saved).length.toLocaleString()}건 · 새로 받을 것 ${missing.length.toLocaleString()}건`)

    let calls = 0
    let stopped = false
    for (let i = 0; i < missing.length && !stopped; i += POOL) {
      const got = await Promise.all(
        missing.slice(i, i + POOL).map(async (p: any) => {
          try {
            calls++
            const { items } = await call<any>('detailPetTour2', { contentId: p.contentid, numOfRows: 10, pageNo: 1 })
            return { id: String(p.contentid), raw: items[0] ?? null }
          } catch (e) {
            if (isQuota(e)) stopped = true
            return null
          }
        })
      )
      for (const g of got) if (g?.raw) saved[g.id] = { ...parseRules(g.raw), raw: g.raw }
      process.stdout.write(`\r  받는 중 ${Math.min(i + POOL, missing.length)} / ${missing.length}`)
    }
    process.stdout.write('\r')
    if (stopped) console.log('  일일 한도에 걸려 여기까지 받았어요.')

    // 저장된 파싱 결과를 그대로 쓰지 않고 **원본에서 다시 판정한다.**
    // 파일은 예전 파서로 만들어졌을 수 있어, 그대로 넣으면 DB 가 현재 로직과 어긋난다.
    // 데이터를 보며 파싱 품질을 확인하는 게 목적이라 이 어긋남이 제일 곤란하다.
    const rows = Object.entries(saved)
      .filter(([, v]) => v)
      .map(([id, v]: [string, any]) => {
        const raw = v.raw ?? {}
        const parsed: any = raw.contentid ? parseRules(raw) : v
        return {
          contentid: id,
          acmpy_type_cd: raw.acmpyTypeCd ?? null,
          acmpy_psbl_cpam: raw.acmpyPsblCpam ?? null,
          acmpy_need_mtr: raw.acmpyNeedMtr ?? null,
          etc_acmpy_info: raw.etcAcmpyInfo ?? null,
          rela_poses_fclty: raw.relaPosesFclty ?? null,
          rela_frnsh_prdlst: raw.relaFrnshPrdlst ?? null,
          rela_purc_prdlst: raw.relaPurcPrdlst ?? null,
          rela_rntl_prdlst: raw.relaRntlPrdlst ?? null,
          rela_acdnt_risk_mtr: raw.relaAcdntRiskMtr ?? null,
          zone: parsed.zone ?? null,
          no_pets: parsed.noPets ?? null,
          service_dog_only: parsed.serviceDogOnly ?? null,
          max_kg: parsed.maxKg ?? null,
          max_kg_inclusive: parsed.maxKgInclusive ?? null,
          allowed_sizes: parsed.allowedSizes ?? null,
          exclude_dangerous: parsed.excludeDangerous ?? null,
          needs: parsed.needs ?? [],
          notes: parsed.notes ?? [],
          zone_hint: parsed.zoneHint ?? null,
          completeness: parsed.completeness ?? null,
          attention: parsed.attention ?? null,
          raw,
        }
      })
    await upsert('pet_rules', rows, 'contentid')
    await logRun('detailPetTour2', rows.length, calls, !stopped, stopped ? '일일 한도 초과' : '')
  }

  // ── ③ 상세 (장소당 4콜)
  if (want('details')) {
    const saved: Record<string, any> = readJson<any>('details.json', { details: {} }).details ?? {}
    const rows = Object.entries(saved).map(([id, d]: [string, any]) => ({
      contentid: id,
      overview: d.overview ?? null,
      homepage: d.homepage ?? null,
      usetime: d.usetime ?? null,
      restdate: d.restdate ?? null,
      parking: d.parking ?? null,
      tels: d.tels ?? [],
      extras: d.extras ?? [],
      images: d.images ?? [],
      common_raw: d.common_raw ?? null,
      intro_raw: d.intro_raw ?? null,
    }))
    console.log(`\n상세 — data/details.json 에서 ${rows.length.toLocaleString()}건`)
    if (rows.length === 0) console.log('  (비어 있어요. `npm run collect` 로 먼저 받으세요)')
    else await upsert('place_details', rows, 'contentid')
  }

  // ── ④ 코드표
  if (want('codes')) {
    console.log('\n코드표를 받는 중…')
    const rows: any[] = []
    let calls = 0

    const sido = await call<any>('ldongCode2', { numOfRows: ALL, pageNo: 1 })
    calls++
    sido.items.forEach((c: any) => rows.push({ source: 'ldong', code: String(c.code), name: c.name, parent: '', depth: 1, raw: c }))
    for (const s of sido.items) {
      const sub = await call<any>('ldongCode2', { lDongRegnCd: s.code, numOfRows: ALL, pageNo: 1 })
      calls++
      sub.items.forEach((c: any) => rows.push({ source: 'ldong', code: String(c.code), name: c.name, parent: String(s.code), depth: 2, raw: c }))
    }

    const d1 = await call<any>('lclsSystmCode2', { numOfRows: ALL, pageNo: 1 })
    calls++
    d1.items.forEach((c: any) => rows.push({ source: 'lcls', code: String(c.code), name: c.name, parent: '', depth: 1, raw: c }))
    for (const a of d1.items) {
      const d2 = await call<any>('lclsSystmCode2', { lclsSystm1: a.code, numOfRows: ALL, pageNo: 1 })
      calls++
      d2.items.forEach((c: any) => rows.push({ source: 'lcls', code: String(c.code), name: c.name, parent: String(a.code), depth: 2, raw: c }))
      for (const b of d2.items) {
        const d3 = await call<any>('lclsSystmCode2', { lclsSystm1: a.code, lclsSystm2: b.code, numOfRows: ALL, pageNo: 1 })
        calls++
        d3.items.forEach((c: any) => rows.push({ source: 'lcls', code: String(c.code), name: c.name, parent: String(b.code), depth: 3, raw: c }))
      }
    }

    // 구버전 2종 — 폐기 예정이지만 번호 체계 비교용으로 함께 넣는다
    const area = await call<any>('areaCode2', { numOfRows: ALL, pageNo: 1 })
    calls++
    area.items.forEach((c: any) => rows.push({ source: 'area', code: String(c.code), name: c.name, parent: '', depth: 1, raw: c }))
    const cat = await call<any>('categoryCode2', { numOfRows: ALL, pageNo: 1 })
    calls++
    cat.items.forEach((c: any) => rows.push({ source: 'category', code: String(c.code), name: c.name, parent: '', depth: 1, raw: c }))

    await upsert('codes', rows, 'source,code,parent')
    await logRun('codes', rows.length, calls, true)
  }

  console.log('\n끝났어요. Supabase 대시보드 → Table Editor 에서 확인하세요.')
}

main().catch((e) => {
  console.error(`\n실패: ${(e as Error).message}`)
  process.exit(1)
})
