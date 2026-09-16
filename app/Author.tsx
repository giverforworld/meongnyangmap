'use client'

import PetFace from './PetFace'
import { ProviderMark } from './PetSwitch'

/**
 * 글·리뷰의 "누가 썼는지" 한 줄.
 *
 * 로그인해서 쓴 글은 계정 사진과 카카오/구글 마크가 붙고(서버가 토큰으로 확인한 것만),
 * 그때 기준이던 아이가 칩으로 따라온다. 비로그인 글은 이니셜 동그라미와 닉네임뿐이다 —
 * 마크가 없다는 것 자체가 "확인되지 않은 글"이라는 표시다.
 */
export interface AuthorInfo {
  nickname: string
  author_avatar?: string | null
  author_provider?: string | null
  pet_name?: string | null
  pet_emoji?: string | null
  pet_label?: string | null
}

const AVATAR_BG = ['#FFE0D3', '#FFF1C2', '#FADDE6', '#FCE9C8', '#E3ECF7', '#DDEFE3', '#EFE3F7']
function initialBg(nick: string) {
  let h = 0
  for (const ch of nick) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return AVATAR_BG[h % AVATAR_BG.length]
}

export function AuthorAvatar({ a, size = 20 }: { a: AuthorInfo; size?: number }) {
  if (a.author_avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={a.author_avatar} alt="" width={size} height={size} referrerPolicy="no-referrer"
        style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flex: 'none', background: '#F6F1E7' }} />
    )
  }
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: initialBg(a.nickname), color: '#6E5F4D', fontSize: size * 0.55, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 'none' }}>
      {a.nickname.slice(0, 1)}
    </span>
  )
}

/** 아이 칩 — "🐶 루비 · 소형견". 리뷰처럼 이름표가 없으면 이름만 */
export function PetChip({ a, size = 16 }: { a: AuthorInfo; size?: number }) {
  if (!a.pet_name) return null
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, fontWeight: 600, color: '#8A7A65', background: '#FAF6EF', border: '1px solid #EFE8DA', borderRadius: 99, padding: '2px 8px 2px 4px', whiteSpace: 'nowrap' }}>
      <PetFace emoji={a.pet_emoji || '🐶'} size={size} />
      {a.pet_name}{a.pet_label ? ` · ${a.pet_label}` : ''}
    </span>
  )
}

export default function Author({ a, size = 20, fontSize = 12.5 }: { a: AuthorInfo; size?: number; fontSize?: number }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
      <AuthorAvatar a={a} size={size} />
      <b style={{ fontSize, color: '#6E5F4D', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 140 }}>{a.nickname}</b>
      {a.author_provider && <ProviderMark provider={a.author_provider} />}
      <PetChip a={a} />
    </span>
  )
}
