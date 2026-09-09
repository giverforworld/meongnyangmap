import type { Pet } from './types'

/**
 * 판정 기준이 되는 반려동물 프로필.
 *
 * 지도(app/page.tsx)와 캠핑(app/hotplace)이 같은 기준으로 판정해야 하므로 여기 둔다.
 * 화면마다 따로 들고 있으면 한쪽만 고쳐져 같은 장소가 다르게 뜬다.
 */
export const PETS: Record<string, Pet> = {
  ruby: {
    key: 'ruby', name: '루비', breed: '요크셔테리어', kg: 4, emoji: '🐶', photo: '/pets/ruby.jpg',
    size: 'small', sizeLabel: '소형견', hasCage: true, hasMuzzle: false, isDangerous: false,
  },
  bori: {
    key: 'bori', name: '보리', breed: '리트리버', kg: 28, emoji: '🦮',
    size: 'large', sizeLabel: '대형견', hasCage: false, hasMuzzle: true, isDangerous: false,
  },
}

export const DEFAULT_PET = 'ruby'
