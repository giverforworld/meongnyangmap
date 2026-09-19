/**
 * 공사 API 를 얼마나 불렀나 — Supabase kto_calls 를 읽어 표로 찍는다.
 *
 *   npm run kto:stats                최근 10일, 날짜×오퍼레이션 호출 수
 *   npm run kto:stats -- 30          최근 30일
 *   npm run kto:stats -- recent      최근 호출 50건 (시각·출처·이름·반환 건수·소요시간)
 *   npm run kto:stats -- recent 200  최근 호출 200건
 *
 * 배치(GitHub Actions)·Vercel 서버·로컬이 같은 인증키로 부른 것이 전부 합쳐져 있다.
 * 시각은 KST. 공공데이터포털에는 이 통계가 없다 — 한도(운영계정 일 100,000 / 개발계정 일 1,000)만 보인다.
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(import.meta.dirname, '..')
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim()
}

const { sbSelect, sbSelectAll } = await import('../lib/supabase.js')
const argv = process.argv.slice(2)
const fmt = (n: number) => n.toLocaleString()

/** 열 너비를 맞춘 표. 첫 열은 왼쪽, 나머지는 오른쪽 정렬 */
function table(header: string[], lines: string[][], leftCols = 1) {
  const w = header.map((h, i) => Math.max(width(h), ...lines.map((l) => width(l[i]))))
  const pad = (s: string, i: number) => (i < leftCols ? s + ' '.repeat(w[i] - width(s)) : ' '.repeat(w[i] - width(s)) + s)
  console.log(header.map(pad).join('  '))
  console.log(w.map((n) => '-'.repeat(n)).join('  '))
  for (const l of lines) console.log(l.map(pad).join('  '))
}
/** 한글은 두 칸 — 열이 어긋나지 않게 */
function width(s: string) {
  let n = 0
  for (const ch of s) n += /[ᄀ-ᇿ㄰-㆏가-힯＀-￯]/.test(ch) ? 2 : 1
  return n
}

function missing(e: Error): never {
  if (e.message.includes('PGRST205')) {
    console.error('kto_calls 표가 없어요 — supabase/2026-09-19_kto_calls.sql 을 Supabase SQL Editor 에서 먼저 실행하세요.')
    process.exit(1)
  }
  throw e
}

// ── 최근 호출 N건 ─────────────────────────────────────────────
if (argv[0] === 'recent') {
  const n = Math.min(Number(argv[1]) || 50, 1000)
  type Row = { at_kst: string; source: string; service: string; op: string; op_name: string; rows: number; ok: boolean; error: string | null; ms: number | null }
  const rows = await sbSelect<Row>(`kto_calls?select=at_kst,source,service,op,op_name,rows,ok,error,ms&order=at.desc&limit=${n}`).catch(missing)
  if (rows.length === 0) {
    console.log('기록이 없어요. 배치가 돌았거나 사이트에서 공사 API 를 부른 뒤에 다시 보세요.')
    process.exit(0)
  }
  console.log(`\n공사 API 최근 호출 ${rows.length}건 (KST)\n`)
  table(
    ['시각', '출처', '오퍼레이션', '이름', '반환', '소요', '결과'],
    rows.map((r) => [
      r.at_kst,
      r.source,
      r.op,
      r.op_name,
      fmt(r.rows),
      r.ms == null ? '' : `${fmt(r.ms)}ms`,
      r.ok ? 'OK' : `실패: ${r.error ?? ''}`.slice(0, 60),
    ]),
    4
  )
  process.exit(0)
}

// ── 날짜×오퍼레이션 합계 ─────────────────────────────────────
const days = Number(argv[0]) || 10
const since = new Date(Date.now() + 9 * 3600_000 - (days - 1) * 86400_000).toISOString().slice(0, 10)
type Daily = { day: string; source: string; service: string; op: string; op_name: string; calls: number; failed: number; rows: number }
// 뷰도 하루 15~25행씩 쌓여 90일이면 1,000행을 넘는다 — 페이지로 끝까지 읽는다
const daily = await sbSelectAll<Daily>(`kto_daily?select=*&day=gte.${since}&order=day.desc,calls.desc`).catch(missing)

if (daily.length === 0) {
  console.log(`최근 ${days}일 기록이 없어요 (${since} 이후). 배치가 돌았거나 사이트에서 공사 API 를 부른 뒤에 다시 보세요.`)
  process.exit(0)
}

// 오퍼레이션은 호출 많은 순으로 열을 놓는다
const opTotal = new Map<string, number>()
for (const r of daily) opTotal.set(r.op, (opTotal.get(r.op) ?? 0) + r.calls)
const ops = [...opTotal.entries()].sort((a, b) => b[1] - a[1]).map(([op]) => op)
const nameOf = new Map(daily.map((r) => [r.op, r.op_name]))

const byDay = new Map<string, Record<string, number>>()
const failedByDay = new Map<string, number>()
for (const r of daily) {
  const c = byDay.get(r.day) ?? {}
  c[r.op] = (c[r.op] ?? 0) + r.calls
  byDay.set(r.day, c)
  failedByDay.set(r.day, (failedByDay.get(r.day) ?? 0) + r.failed)
}

console.log(`\n공사 API 호출 수 — 최근 ${days}일 (${since} ~, KST)\n`)
const lines = [...byDay.entries()].map(([day, c]) => {
  const total = Object.values(c).reduce((a, b) => a + b, 0)
  const failed = failedByDay.get(day) ?? 0
  return [day, ...ops.map((o) => fmt(c[o] ?? 0)), fmt(total), failed ? fmt(failed) : '']
})
lines.push(['합계', ...ops.map((o) => fmt(opTotal.get(o)!)), fmt([...opTotal.values()].reduce((a, b) => a + b, 0)), ''])
table(['날짜', ...ops, '합계', '실패'], lines)

// 출처별 — 배치·서버·로컬이 각각 얼마나
const bySource = new Map<string, { calls: number; rows: number }>()
for (const r of daily) {
  const s = bySource.get(r.source) ?? { calls: 0, rows: 0 }
  s.calls += r.calls
  s.rows += r.rows
  bySource.set(r.source, s)
}
console.log('\n출처별')
table(
  ['출처', '호출', '반환 행 합계'],
  [...bySource.entries()].map(([s, v]) => [s, fmt(v.calls), fmt(v.rows)])
)

console.log('\n오퍼레이션 이름')
table(['오퍼레이션', '이름', '서비스'], ops.map((o) => [o, nameOf.get(o) ?? '', daily.find((r) => r.op === o)!.service]), 3)
