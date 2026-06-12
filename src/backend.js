import { createClient } from '@supabase/supabase-js'
import { DEMO_COMMENTS, DEMO_REVIEWS } from './demo-data.js'
import { generateId } from './utils.js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const REQUEST_TIMEOUT_MS = 30_000

export const turnstileSiteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY ?? ''
export const hasSupabaseConfig = Boolean(
  supabaseUrl &&
    supabaseAnonKey &&
    !supabaseUrl.includes('YOUR_PROJECT') &&
    !supabaseAnonKey.includes('YOUR_'),
)

export class CaptchaRequiredError extends Error {
  constructor() {
    super('需要完成人机验证')
    this.name = 'CaptchaRequiredError'
  }
}

export function createBackend() {
  if (!hasSupabaseConfig) return createDemoBackend()

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
    global: {
      fetch: fetchWithTimeout,
    },
  })

  let userId = null

  async function ensureSession(captchaToken) {
    const {
      data: { session },
    } = await supabase.auth.getSession()

    if (session?.user) {
      userId = session.user.id
      return session.user
    }

    if (turnstileSiteKey && !captchaToken) throw new CaptchaRequiredError()

    const { data, error } = await supabase.auth.signInAnonymously({
      options: captchaToken ? { captchaToken } : undefined,
    })
    if (error) throw error
    userId = data.user.id
    return data.user
  }

  async function listReviews(filters = {}) {
    let query = supabase.from('review_feed').select('*').limit(60)

    if (filters.floor !== 'all') query = query.eq('floor', Number(filters.floor))
    if (filters.rating !== 'all') query = query.eq('rating', Number(filters.rating))

    query =
      filters.sort === 'popular'
        ? query.order('like_count', { ascending: false }).order('created_at', {
            ascending: false,
          })
        : query.order('created_at', { ascending: false })

    const { data, error } = await query
    if (error) throw error
    return hydrateReviews(data ?? [])
  }

  async function getReview(reviewId) {
    const { data, error } = await supabase
      .from('review_feed')
      .select('*')
      .eq('id', reviewId)
      .maybeSingle()
    if (error) throw error
    if (!data) return null
    return (await hydrateReviews([data]))[0]
  }

  async function hydrateReviews(reviews) {
    if (!reviews.length) return []
    const reviewIds = reviews.map((review) => review.id)
    const {
      data: { session },
    } = await supabase.auth.getSession()
    const sessionUser = userId ?? session?.user?.id ?? null

    const [likesResult, signedUrls] = await Promise.all([
      sessionUser
        ? supabase
            .from('likes')
            .select('review_id')
            .eq('user_id', sessionUser)
            .in('review_id', reviewIds)
        : Promise.resolve({ data: [], error: null }),
      Promise.all(
        reviews.map(async (review) => {
          const { data, error } = await supabase.storage
            .from('food-photos')
            .createSignedUrl(review.image_path, 60 * 60)
          if (error) return ''
          return data.signedUrl
        }),
      ),
    ])

    const { data: likes, error: likesError } = likesResult
    if (likesError) throw likesError
    const likedIds = new Set((likes ?? []).map((like) => like.review_id))

    return reviews.map((review, index) => ({
      ...review,
      image_url: signedUrls[index],
      liked_by_me: likedIds.has(review.id),
    }))
  }

  async function getComments(reviewId) {
    const { data, error } = await supabase
      .from('comments')
      .select('id, nickname, body, created_at')
      .eq('review_id', reviewId)
      .eq('status', 'approved')
      .order('created_at', { ascending: true })
    if (error) throw error
    return data ?? []
  }

  async function submitReview(input, imageBlob, onProgress = () => {}) {
    onProgress('正在连接账号…')
    const user = await ensureSession()
    const reviewId = generateId()
    const imagePath = `${user.id}/${reviewId}.webp`

    onProgress('正在上传照片…')
    const { error: uploadError } = await supabase.storage
      .from('food-photos')
      .upload(imagePath, imageBlob, {
        contentType: 'image/webp',
        cacheControl: '3600',
        upsert: false,
      })
    if (uploadError) throw uploadError

    onProgress('正在保存饭评…')
    const { error: insertError } = await supabase.from('reviews').insert({
      id: reviewId,
      author_id: user.id,
      nickname: input.nickname.trim(),
      floor: Number(input.floor),
      stall: input.stall.trim(),
      dish_name: input.dishName.trim(),
      price: Number(input.price),
      rating: Number(input.rating),
      review_text: input.reviewText.trim(),
      image_path: imagePath,
    })

    if (insertError) {
      await supabase.storage.from('food-photos').remove([imagePath])
      throw insertError
    }
    return { id: reviewId, status: 'pending' }
  }

  async function submitComment(reviewId, input) {
    const user = await ensureSession()
    const { error } = await supabase.from('comments').insert({
      review_id: reviewId,
      author_id: user.id,
      nickname: input.nickname.trim(),
      body: input.body.trim(),
    })
    if (error) throw error
    return { status: 'pending' }
  }

  async function toggleLike(reviewId, liked) {
    const user = await ensureSession()
    if (liked) {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('review_id', reviewId)
        .eq('user_id', user.id)
      if (error) throw error
      return false
    }

    const { error } = await supabase.from('likes').insert({
      review_id: reviewId,
      user_id: user.id,
    })
    if (error && error.code !== '23505') throw error
    return true
  }

  return {
    isDemo: false,
    ensureSession,
    listReviews,
    getReview,
    getComments,
    submitReview,
    submitComment,
    toggleLike,
  }
}

function createDemoBackend() {
  let reviews = structuredClone(DEMO_REVIEWS)
  const comments = structuredClone(DEMO_COMMENTS)

  return {
    isDemo: true,
    async ensureSession() {
      return { id: 'demo-user' }
    },
    async listReviews(filters = {}) {
      await shortDelay()
      let result = [...reviews]
      if (filters.floor !== 'all') {
        result = result.filter((review) => review.floor === Number(filters.floor))
      }
      if (filters.rating !== 'all') {
        result = result.filter((review) => review.rating === Number(filters.rating))
      }
      result.sort((a, b) =>
        filters.sort === 'popular'
          ? b.like_count - a.like_count
          : new Date(b.created_at) - new Date(a.created_at),
      )
      return structuredClone(result)
    },
    async getReview(reviewId) {
      return structuredClone(reviews.find((review) => review.id === reviewId) ?? null)
    },
    async getComments(reviewId) {
      await shortDelay()
      return structuredClone(comments[reviewId] ?? [])
    },
    async submitReview(input, imageBlob, onProgress = () => {}) {
      onProgress('正在上传照片…')
      await shortDelay()
      onProgress('正在保存饭评…')
      return { id: generateId(), status: 'pending' }
    },
    async submitComment() {
      await shortDelay()
      return { status: 'pending' }
    },
    async toggleLike(reviewId, liked) {
      const review = reviews.find((item) => item.id === reviewId)
      if (!review) throw new Error('评价不存在')
      review.liked_by_me = !liked
      review.like_count += liked ? -1 : 1
      return !liked
    },
  }
}

function shortDelay() {
  return new Promise((resolve) => setTimeout(resolve, 180))
}

async function fetchWithTimeout(input, init = {}) {
  const controller = new AbortController()
  const externalSignal = init.signal
  const abortFromExternalSignal = () => controller.abort(externalSignal.reason)
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  if (externalSignal?.aborted) abortFromExternalSignal()
  else externalSignal?.addEventListener('abort', abortFromExternalSignal, { once: true })

  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } catch (error) {
    if (controller.signal.aborted && !externalSignal?.aborted) {
      throw new Error('网络请求超时，请检查网络后重试')
    }
    throw error
  } finally {
    window.clearTimeout(timeoutId)
    externalSignal?.removeEventListener('abort', abortFromExternalSignal)
  }
}
