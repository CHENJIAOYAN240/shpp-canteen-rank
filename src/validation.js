import {
  MAX_COMMENT_LENGTH,
  MAX_IMAGE_BYTES,
  MAX_NICKNAME_LENGTH,
  MAX_REVIEW_LENGTH,
} from './constants.js'

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function textLength(value) {
  return Array.from(String(value ?? '').trim()).length
}

export function validateImageFile(file) {
  if (!file || file.size === 0) return '请上传食物照片'
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return '仅支持 JPG、PNG 或 WebP 图片'
  if (file.size > MAX_IMAGE_BYTES) return '图片不能超过 5MB'
  return ''
}

export function validateReviewInput(input) {
  const errors = {}

  if (![1, 2, 3].includes(Number(input.floor))) errors.floor = '请选择食堂楼层'
  if (!String(input.stall ?? '').trim()) errors.stall = '请填写窗口或档口'
  if (textLength(input.stall) > 40) errors.stall = '窗口名称不能超过40字'
  if (!String(input.dishName ?? '').trim()) errors.dishName = '请填写菜名'
  if (textLength(input.dishName) > 60) errors.dishName = '菜名不能超过60字'

  const rawPrice = String(input.price ?? '').trim()
  const price = Number(rawPrice)
  if (!rawPrice || !Number.isFinite(price) || price < 0 || price > 999.99) {
    errors.price = '请输入0到999.99之间的价格'
  }

  if (![1, 2, 3, 4, 5].includes(Number(input.rating))) {
    errors.rating = '请选择评价等级'
  }

  if (!String(input.reviewText ?? '').trim()) errors.reviewText = '写一句真实体验吧'
  if (textLength(input.reviewText) > MAX_REVIEW_LENGTH) {
    errors.reviewText = `短评不能超过${MAX_REVIEW_LENGTH}字`
  }

  if (!String(input.nickname ?? '').trim()) errors.nickname = '请填写昵称'
  if (textLength(input.nickname) > MAX_NICKNAME_LENGTH) {
    errors.nickname = `昵称不能超过${MAX_NICKNAME_LENGTH}字`
  }

  const imageError = validateImageFile(input.image)
  if (imageError) errors.image = imageError

  return errors
}

export function validateCommentInput(input) {
  const errors = {}
  if (!String(input.nickname ?? '').trim()) errors.nickname = '请填写昵称'
  if (textLength(input.nickname) > MAX_NICKNAME_LENGTH) {
    errors.nickname = `昵称不能超过${MAX_NICKNAME_LENGTH}字`
  }
  if (!String(input.body ?? '').trim()) errors.body = '评论不能为空'
  if (textLength(input.body) > MAX_COMMENT_LENGTH) {
    errors.body = `评论不能超过${MAX_COMMENT_LENGTH}字`
  }
  return errors
}
