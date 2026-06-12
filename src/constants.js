export const SCHOOL_NAME = '上海出版印刷高等专科学校'

export const FLOORS = [
  { value: 'all', label: '全部楼层' },
  { value: 1, label: '一楼' },
  { value: 2, label: '二楼' },
  { value: 3, label: '三楼' },
]

export const RATINGS = [
  { value: 5, label: '夯', short: '夯', color: '#ff5a36' },
  { value: 4, label: '顶', short: '顶', color: '#ff9d2e' },
  { value: 3, label: '还行', short: '还行', color: '#72a96b' },
  { value: 2, label: '一般', short: '一般', color: '#78839a' },
  { value: 1, label: '拉', short: '拉', color: '#594f67' },
]

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024
export const MAX_IMAGE_EDGE = 1600
export const MAX_REVIEW_LENGTH = 200
export const MAX_COMMENT_LENGTH = 120
export const MAX_NICKNAME_LENGTH = 20

export function getRating(value) {
  return RATINGS.find((rating) => rating.value === Number(value)) ?? RATINGS[2]
}

export function floorLabel(value) {
  return FLOORS.find((floor) => floor.value === Number(value))?.label ?? `${value}楼`
}
