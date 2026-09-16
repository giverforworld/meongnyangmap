'use client'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { PetInput } from './pets'

/**
 * 프로필을 계정에 올리고 내리는 일.
 *
 * 브라우저가 anon 키로 직접 읽고 쓴다. 누가 누구 것을 보느냐는 RLS 가 막는다
 * (supabase/pets.sql). 여기서 user_id 를 따로 거르지 않는 이유가 그것이다 —
 * 걸러도 방어가 되지 않고, 안 걸러도 뚫리지 않는다.
 *
 * 실패는 전부 삼킨다. 동기화가 안 되면 브라우저 저장본으로 계속 쓰면 되고,
 * 그걸 알리려고 화면을 멈추는 것보다 다음 저장에서 다시 시도하는 편이 낫다.
 */

interface Row {
  key: string
  name: string
  species: 'dog' | 'cat' | null
  kg: number | string
  emoji: string
  has_cage: boolean
  has_muzzle: boolean
  is_dangerous: boolean
}

const toInput = (r: Row): PetInput => ({
  key: r.key,
  name: r.name,
  species: r.species === 'cat' ? 'cat' : 'dog',
  kg: Number(r.kg),
  emoji: r.emoji || '🐶',
  hasCage: Boolean(r.has_cage),
  hasMuzzle: Boolean(r.has_muzzle),
  dangerous: Boolean(r.is_dangerous),
})

const toRow = (userId: string, p: PetInput) => ({
  user_id: userId,
  key: p.key,
  name: p.name,
  species: p.species ?? 'dog',
  kg: p.kg,
  emoji: p.emoji,
  has_cage: p.hasCage,
  has_muzzle: p.hasMuzzle,
  is_dangerous: p.dangerous,
})

export async function fetchRemotePets(sb: SupabaseClient): Promise<PetInput[] | null> {
  const { data, error } = await sb
    .from('pets')
    .select('key,name,species,kg,emoji,has_cage,has_muzzle,is_dangerous')
    .order('created_at')
  if (error) return null
  return (data as Row[]).map(toInput)
}

/** 있으면 고치고 없으면 넣는다. (user_id, key) 가 유일키라 upsert 로 끝난다 */
export async function upsertRemotePets(sb: SupabaseClient, userId: string, pets: PetInput[]) {
  if (pets.length === 0) return
  await sb.from('pets').upsert(pets.map((p) => toRow(userId, p)), { onConflict: 'user_id,key' })
}

export async function deleteRemotePet(sb: SupabaseClient, key: string) {
  await sb.from('pets').delete().eq('key', key)
}
