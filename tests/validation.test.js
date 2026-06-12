import { describe, expect, it } from 'vitest'
import {
  validateCommentInput,
  validateImageFile,
  validateReviewInput,
} from '../src/validation.js'

const validImage = {
  type: 'image/jpeg',
  size: 1024,
}

const validReview = {
  floor: 1,
  stall: '西北风味窗口',
  dishName: '孜然鸡排拌饭',
  price: 15,
  rating: 5,
  reviewText: '鸡排很脆，分量也够。',
  nickname: '不愿早八',
  image: validImage,
}

describe('validateImageFile', () => {
  it('accepts supported images within 5MB', () => {
    expect(validateImageFile(validImage)).toBe('')
  })

  it('rejects unsupported or oversized images', () => {
    expect(validateImageFile({ type: '', size: 0 })).toBe('请上传食物照片')
    expect(validateImageFile({ type: 'image/gif', size: 100 })).toContain('JPG')
    expect(validateImageFile({ type: 'image/png', size: 6 * 1024 * 1024 })).toContain(
      '5MB',
    )
  })
})

describe('validateReviewInput', () => {
  it('accepts a complete review', () => {
    expect(validateReviewInput(validReview)).toEqual({})
  })

  it('rejects invalid floor, price, rating and long text', () => {
    const errors = validateReviewInput({
      ...validReview,
      floor: 4,
      price: -1,
      rating: 7,
      reviewText: '测'.repeat(201),
    })

    expect(errors.floor).toBeTruthy()
    expect(errors.price).toBeTruthy()
    expect(errors.rating).toBeTruthy()
    expect(errors.reviewText).toBeTruthy()
  })

  it('does not interpret an empty price as zero', () => {
    expect(validateReviewInput({ ...validReview, price: '' }).price).toBeTruthy()
  })
})

describe('validateCommentInput', () => {
  it('requires a nickname and body', () => {
    expect(validateCommentInput({ nickname: '', body: '' })).toEqual({
      nickname: '请填写昵称',
      body: '评论不能为空',
    })
  })

  it('rejects comments longer than 120 characters', () => {
    expect(
      validateCommentInput({ nickname: '同学', body: '评'.repeat(121) }).body,
    ).toContain('120')
  })
})
