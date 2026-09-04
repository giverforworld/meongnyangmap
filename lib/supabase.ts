/**
 * Supabase REST(PostgREST) 얇은 클라이언트 — 서버 전용.
 *
 * service_role 키를 쓴다. RLS 를 우회하므로 **절대 브라우저로 나가면 안 된다.**
 * 이 파일을 클라이언트 컴포넌트에서 import 하지 말 것.
 */
const URL_ = process.env.SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

export const boardReady = Boolean(URL_ && KEY)

function headers(extra: Record<string, string> = {}) {
  return {
    apikey: KEY!,
    Authorization: `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

export async function sbSelect<T>(path: string): Promise<T[]> {
  const res = await fetch(`${URL_}/rest/v1/${path}`, { headers: headers(), cache: 'no-store' })
  if (!res.ok) throw new Error(`조회 실패 (${res.status}): ${(await res.text()).slice(0, 200)}`)
  return res.json()
}

export async function sbInsert<T>(table: string, row: unknown): Promise<T> {
  const res = await fetch(`${URL_}/rest/v1/${table}`, {
    method: 'POST',
    headers: headers({ Prefer: 'return=representation' }),
    body: JSON.stringify([row]),
  })
  if (!res.ok) throw new Error(`저장 실패 (${res.status}): ${(await res.text()).slice(0, 200)}`)
  return (await res.json())[0]
}

export async function sbUpdate(table: string, filter: string, patch: unknown) {
  const res = await fetch(`${URL_}/rest/v1/${table}?${filter}`, {
    method: 'PATCH',
    headers: headers({ Prefer: 'return=minimal' }),
    body: JSON.stringify(patch),
  })
  if (!res.ok) throw new Error(`수정 실패 (${res.status}): ${(await res.text()).slice(0, 200)}`)
}
