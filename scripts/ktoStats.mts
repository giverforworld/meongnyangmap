/**
 * 공사 API 를 날짜별·오퍼레이션별로 몇 번 불렀나 — Supabase kto_calls 를 읽어 표로 찍는다.
 *
 *   npm run kto:stats          최근 10일
 *   npm run kto:stats -- 30    최근 30일
 *
 * 배치(GitHub Actions)·Vercel 서버·로컬이 같은 인증키로 부른 것이 전부 합쳐져 있다.
 * 날짜는 KST. 공공데이터포털에는 이 통계가 없다 — 한도(운영계정 일 100,000 / 개발계정 일 1,000)만 보인다.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const days = Number(process.argv[2]) || 10

const { sbSelect } = await import('../lib/supabase.js')
const since = new Date(Date.now() + 9 * 3600_000 - (days - 1) * 86400_000).toISOString().slice(0, 10)
const rows = await sbSelect<{ day: string; op: string; n: number }>(
  `kto_calls?select=day,op,n&day=gte.${since}&order=day.desc,n.desc`
).catch((e: Error) => {
  if (e.message.includes('PGRST205')) {
    console.error('kto_calls 표가 없어요 — supabase/2026-09-19_kto_calls.sql 을 Supabase SQL Editor 에서 먼저 실행하세요.')
    process.exit(1)
  }
  throw e
})

if (rows.length === 0) {
  console.log(`최근 ${days}일 기록이 없어요 (${since} 이후). supabase/2026-09-19_kto_calls.sql 을 실행했는지, 배치가 돌았는지 확인.`)
  process.exit(0)
}

const ops = [...new Set(rows.map((r) => r.op))]
const byDay = new Map<string, Record<string, number>>()
for (const r of rows) (byDay.get(r.day) ?? byDay.set(r.day, {}).get(r.day)!)[r.op] = r.n

// 오퍼레이션 이름은 'KorPetTourService2/detailPetTour2' 에서 뒤쪽만 — 열이 좁아진다
const short = (op: string) => op.split('/').pop()!
const fmt = (n: number) => n.toLocaleString()

const header = ['날짜(KST)', ...ops.map(short), '합계']
const lines = [...byDay.entries()].map(([day, c]) => {
  const total = Object.values(c).reduce((a, b) => a + b, 0)
  return [day, ...ops.map((o) => fmt(c[o] ?? 0)), fmt(total)]
})
const totals = ops.map((o) => rows.filter((r) => r.op === o).reduce((a, r) => a + r.n, 0))
lines.push(['합계', ...totals.map(fmt), fmt(totals.reduce((a, b) => a + b, 0))])

const widths = header.map((h, i) => Math.max(h.length, ...lines.map((l) => l[i].length)))
const pad = (s: string, i: number) => (i === 0 ? s.padEnd(widths[i]) : s.padStart(widths[i]))
console.log(`\n공사 API 호출 — 최근 ${days}일 (${since} ~)\n`)
console.log(header.map(pad).join('  '))
console.log(widths.map((w) => '-'.repeat(w)).join('  '))
for (const l of lines) console.log(l.map(pad).join('  '))
console.log(`\n서비스별 접두어: ${ops.map((o) => `${short(o)} ← ${o.split('/')[0]}`).join(' · ')}`)
