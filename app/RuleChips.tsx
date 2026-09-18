import type { PetRules } from '@/lib/types'
import { ruleChips } from './placeUi'

/**
 * 카드의 조건 칩 줄 — 구역(● 전 구역 / ◐ 일부 구역)·체중·준비물을 한 단어씩.
 * 걸릴 수 있는 것(일부 구역·체중·맹견 불가)은 노랑, 챙길 것은 베이지. 값이 없으면 아무것도 안 그린다.
 */
export default function RuleChips({ rules, size = 'sm' }: { rules: PetRules | null; size?: 'sm' | 'md' }) {
  const chips = ruleChips(rules)
  if (chips.length === 0) return null
  const fs = size === 'md' ? 12 : 11
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 1 }}>
      {chips.map((c) => (
        <span key={c.text} style={{
          display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: fs, fontWeight: 700, lineHeight: 1.3,
          padding: size === 'md' ? '2px 9px' : '1px 7px', borderRadius: 99, whiteSpace: 'nowrap',
          background: c.tone === 'warn' ? '#FFF7D6' : '#F6F1E7', color: c.tone === 'warn' ? '#9A7300' : '#6E5F4D',
          border: `1px solid ${c.tone === 'warn' ? '#F0D9A0' : '#EAE3D6'}`,
        }}>
          {c.icon && <span style={{ fontSize: fs - 1 }}>{c.icon}</span>}{c.text}
        </span>
      ))}
    </div>
  )
}
