import './styles.css'
import {
  FLOORS,
  MAX_COMMENT_LENGTH,
  MAX_NICKNAME_LENGTH,
  MAX_REVIEW_LENGTH,
  RATINGS,
  SCHOOL_NAME,
  floorLabel,
  getRating,
} from './constants.js'
import {
  CaptchaRequiredError,
  createBackend,
  turnstileSiteKey,
} from './backend.js'
import { compressImage } from './image.js'
import { escapeHtml, formatPrice, formatRelativeTime } from './utils.js'
import {
  validateCommentInput,
  validateImageFile,
  validateReviewInput,
} from './validation.js'

const backend = createBackend()
const app = document.querySelector('#app')

const state = {
  filters: { floor: 'all', rating: 'all', sort: 'latest' },
  reviews: [],
  activeReview: null,
  loading: true,
  nickname: localStorage.getItem('canteen-nickname') ?? '',
  preparedImage: null,
  imagePreparation: null,
  imagePreparationError: null,
  imagePreparationId: 0,
}

renderShell()
bindEvents()
bootstrap()

async function bootstrap() {
  try {
    await loadReviews()
    openReviewFromHash()
  } catch (error) {
    showFatalError(error)
  }
}

function renderShell() {
  app.innerHTML = `
    <header class="site-header">
      <a class="brand" href="#" aria-label="食堂夯榜首页">
        <span class="brand-bowl" aria-hidden="true">夯</span>
        <span>
          <strong>食堂夯榜</strong>
          <small>上版印学生真实饭评</small>
        </span>
      </a>
      <button class="header-submit" type="button" data-open-submit>
        <span aria-hidden="true">＋</span> 我要晒饭
      </button>
    </header>

    <main>
      <section class="hero">
        <div class="hero-copy">
          <p class="eyebrow">${SCHOOL_NAME} · 食堂一至三楼</p>
          <h1>今天这口，<br><em>夯</em>还是<em>拉</em>？</h1>
          <p class="hero-intro">不看广告，看同学吃完怎么说。真实价格、真实照片、真实踩雷记录。</p>
          <button class="hero-submit" type="button" data-open-submit>晒出你今天这顿饭</button>
        </div>
        <div class="hero-scoreboard" aria-label="评价等级说明">
          <p>本校饭圈暗号</p>
          ${RATINGS.map(
            (rating, index) => `
              <div class="scoreboard-row" style="--row-color:${rating.color}; --delay:${index * 50}ms">
                <b>${rating.label}</b>
                <span>${ratingDescription(rating.value)}</span>
                <i>${rating.value}.0</i>
              </div>
            `,
          ).join('')}
        </div>
      </section>

      <section class="feed-section">
        <div class="feed-heading">
          <div>
            <p class="section-kicker">CANTEEN LIVE</p>
            <h2>同学刚吃了什么</h2>
          </div>
          <div class="feed-stat">
            <strong id="reviewCount">--</strong>
            <span>份真实饭评</span>
          </div>
        </div>

        ${
          backend.isDemo
            ? `
              <div class="demo-notice">
                <span>演示模式</span>
                当前展示示例数据。配置 Supabase 后，投稿、审核和互动会自动切换为真实数据。
              </div>
            `
            : ''
        }

        <div class="filters" aria-label="饭评筛选">
          <div class="filter-group">
            <span class="filter-label">楼层</span>
            <div class="chip-row" id="floorFilters">
              ${FLOORS.map(
                (floor) => `
                  <button class="filter-chip ${floor.value === 'all' ? 'active' : ''}" 
                    type="button" data-filter="floor" data-value="${floor.value}">
                    ${floor.label}
                  </button>
                `,
              ).join('')}
            </div>
          </div>
          <div class="filter-group">
            <span class="filter-label">等级</span>
            <div class="chip-row" id="ratingFilters">
              <button class="filter-chip active" type="button" data-filter="rating" data-value="all">全部</button>
              ${RATINGS.map(
                (rating) => `
                  <button class="filter-chip" type="button" data-filter="rating" data-value="${rating.value}">
                    ${rating.label}
                  </button>
                `,
              ).join('')}
            </div>
          </div>
          <div class="sort-toggle" aria-label="排序方式">
            <button class="active" type="button" data-sort="latest">最新</button>
            <button type="button" data-sort="popular">最热</button>
          </div>
        </div>

        <div class="review-grid" id="reviewGrid" aria-live="polite">${renderSkeletons()}</div>
      </section>
    </main>

    <footer>
      <strong>食堂夯榜</strong>
      <p>由同学共同维护的校园食堂真实评价。请友善发言，尊重食堂工作人员。</p>
      <span>非学校官方项目 · ${new Date().getFullYear()}</span>
    </footer>

    <button class="mobile-fab" type="button" data-open-submit aria-label="发布饭评">＋</button>

    <dialog class="modal submit-modal" id="submitDialog">
      <form class="submit-form" id="reviewForm" novalidate>
        <div class="modal-topline">
          <div>
            <p class="section-kicker">NEW REVIEW</p>
            <h2>晒出今天这顿</h2>
          </div>
          <button class="icon-button" type="button" data-close-dialog aria-label="关闭">×</button>
        </div>

        <div class="photo-field">
          <input id="foodPhoto" name="image" type="file" accept="image/jpeg,image/png,image/webp" required>
          <label for="foodPhoto" id="photoLabel">
            <span class="photo-plus">＋</span>
            <strong>上传食物照片</strong>
            <small>JPG / PNG / WebP，最大5MB</small>
          </label>
          <img id="photoPreview" alt="待上传食物预览" hidden>
          <span class="photo-status" id="photoStatus" aria-live="polite"></span>
        </div>
        <p class="field-error" data-error-for="image"></p>

        <div class="form-grid two-columns">
          <label class="field">
            <span>楼层</span>
            <select name="floor" required>
              <option value="">请选择</option>
              <option value="1">一楼</option>
              <option value="2">二楼</option>
              <option value="3">三楼</option>
            </select>
            <small class="field-error" data-error-for="floor"></small>
          </label>
          <label class="field">
            <span>价格</span>
            <div class="price-input"><i>¥</i><input name="price" type="number" min="0" max="999.99" step="0.5" placeholder="12.5" required></div>
            <small class="field-error" data-error-for="price"></small>
          </label>
        </div>

        <div class="form-grid two-columns">
          <label class="field">
            <span>窗口 / 档口</span>
            <input name="stall" maxlength="40" placeholder="例如：西北风味窗口" required>
            <small class="field-error" data-error-for="stall"></small>
          </label>
          <label class="field">
            <span>菜名</span>
            <input name="dishName" maxlength="60" placeholder="例如：孜然鸡排拌饭" required>
            <small class="field-error" data-error-for="dishName"></small>
          </label>
        </div>

        <fieldset class="rating-picker">
          <legend>这顿饭什么水平？</legend>
          <div>
            ${RATINGS.map(
              (rating) => `
                <label style="--rating-color:${rating.color}">
                  <input type="radio" name="rating" value="${rating.value}">
                  <span>${rating.label}</span>
                </label>
              `,
            ).join('')}
          </div>
          <small class="field-error" data-error-for="rating"></small>
        </fieldset>

        <label class="field">
          <span>一句真实体验 <i id="reviewCounter">0/${MAX_REVIEW_LENGTH}</i></span>
          <textarea name="reviewText" rows="4" maxlength="${MAX_REVIEW_LENGTH}" placeholder="口味、分量、排队时间，都可以说说……" required></textarea>
          <small class="field-error" data-error-for="reviewText"></small>
        </label>

        <label class="field">
          <span>你的昵称</span>
          <input name="nickname" maxlength="${MAX_NICKNAME_LENGTH}" value="${escapeHtml(state.nickname)}" placeholder="不用真名也可以" required>
          <small class="field-error" data-error-for="nickname"></small>
        </label>

        <label class="content-rule">
          <input type="checkbox" name="rulesAccepted" required>
          <span>我确认照片不含清晰人脸、联系方式或广告，评价不辱骂他人且内容真实。</span>
        </label>

        <button class="primary-button" type="submit">提交审核</button>
        <p class="form-hint">投稿不会立即公开，审核通过后会出现在首页。</p>
      </form>
    </dialog>

    <dialog class="modal detail-modal" id="detailDialog">
      <div id="detailContent"></div>
    </dialog>

    <div class="toast-region" id="toastRegion" aria-live="polite"></div>
    <div id="authGate"></div>
  `
}

function bindEvents() {
  app.addEventListener('click', async (event) => {
    const openSubmit = event.target.closest('[data-open-submit]')
    if (openSubmit) {
      document.querySelector('#submitDialog').showModal()
      return
    }

    const closeButton = event.target.closest('[data-close-dialog]')
    if (closeButton) {
      closeButton.closest('dialog').close()
      if (closeButton.closest('#detailDialog')) clearReviewHash()
      return
    }

    const filterButton = event.target.closest('[data-filter]')
    if (filterButton) {
      state.filters[filterButton.dataset.filter] = filterButton.dataset.value
      updateActiveFilter(filterButton)
      await loadReviews()
      return
    }

    const sortButton = event.target.closest('[data-sort]')
    if (sortButton) {
      state.filters.sort = sortButton.dataset.sort
      document.querySelectorAll('[data-sort]').forEach((button) => {
        button.classList.toggle('active', button === sortButton)
      })
      await loadReviews()
      return
    }

    const reviewCard = event.target.closest('[data-review-id]')
    const likeButton = event.target.closest('[data-like-id]')
    const shareButton = event.target.closest('[data-share-id]')
    if (shareButton) {
      event.stopPropagation()
      await shareReview(shareButton.dataset.shareId)
      return
    }
    if (likeButton) {
      event.stopPropagation()
      await handleLike(likeButton.dataset.likeId)
      return
    }
    if (reviewCard) {
      window.location.hash = `review=${reviewCard.dataset.reviewId}`
    }
  })

  document.querySelector('#foodPhoto').addEventListener('change', showPhotoPreview)
  document
    .querySelector('[name="reviewText"]')
    .addEventListener('input', updateReviewCounter)
  document.querySelector('#reviewForm').addEventListener('submit', submitReview)

  document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) {
        dialog.close()
        if (dialog.id === 'detailDialog') clearReviewHash()
      }
    })
  })

  window.addEventListener('hashchange', openReviewFromHash)
  app.addEventListener('keydown', (event) => {
    if (!['Enter', ' '].includes(event.key)) return
    if (event.target.closest('button, input, select, textarea, a')) return

    const reviewCard = event.target.closest('[data-review-id]')
    if (!reviewCard) return
    event.preventDefault()
    window.location.hash = `review=${reviewCard.dataset.reviewId}`
  })
}

async function loadReviews() {
  const grid = document.querySelector('#reviewGrid')
  state.loading = true
  grid.innerHTML = renderSkeletons()

  try {
    state.reviews = await backend.listReviews(state.filters)
    document.querySelector('#reviewCount').textContent = state.reviews.length
    grid.innerHTML = state.reviews.length
      ? state.reviews.map(renderReviewCard).join('')
      : renderEmptyState()
  } catch (error) {
    grid.innerHTML = renderLoadError(error)
  } finally {
    state.loading = false
  }
}

function renderReviewCard(review) {
  const rating = getRating(review.rating)
  return `
    <article class="review-card" data-review-id="${review.id}" tabindex="0"
      aria-label="查看${escapeHtml(review.dish_name)}的饭评"
      style="--rating-color:${rating.color}">
      <div class="card-photo">
        ${
          review.image_url
            ? `<img src="${escapeHtml(review.image_url)}" alt="${escapeHtml(review.dish_name)}" loading="lazy">`
            : '<div class="image-fallback">暂无图片</div>'
        }
        <span class="rating-stamp">${rating.label}</span>
        <span class="floor-tag">${floorLabel(review.floor)}</span>
      </div>
      <div class="card-body">
        <div class="dish-line">
          <div>
            <p>${escapeHtml(review.stall)}</p>
            <h3>${escapeHtml(review.dish_name)}</h3>
          </div>
          <strong>${formatPrice(review.price)}</strong>
        </div>
        <blockquote>“${escapeHtml(review.review_text)}”</blockquote>
        <div class="card-meta">
          <span class="avatar">${escapeHtml(review.nickname.slice(0, 1))}</span>
          <span>${escapeHtml(review.nickname)}</span>
          <time>${formatRelativeTime(review.created_at)}</time>
          <div class="card-actions">
            <button class="like-button ${review.liked_by_me ? 'liked' : ''}" type="button" 
              data-like-id="${review.id}" aria-label="${review.liked_by_me ? '取消点赞' : '点赞'}">
              <span aria-hidden="true">♥</span><b>${review.like_count ?? 0}</b>
            </button>
            <span class="comment-count">◌ ${review.comment_count ?? 0}</span>
          </div>
        </div>
      </div>
    </article>
  `
}

async function handleLike(reviewId) {
  const review =
    state.reviews.find((item) => item.id === reviewId) ??
    (state.activeReview?.id === reviewId ? state.activeReview : null)
  if (!review) return

  const previousLiked = review.liked_by_me
  review.liked_by_me = !previousLiked
  review.like_count += previousLiked ? -1 : 1
  updateLikeButtons(review)

  try {
    review.liked_by_me = await withCaptchaRetry(() =>
      backend.toggleLike(reviewId, previousLiked),
    )
  } catch (error) {
    review.liked_by_me = previousLiked
    review.like_count += previousLiked ? 1 : -1
    updateLikeButtons(review)
    showToast(humanizeError(error), 'error')
  }
}

function updateLikeButtons(review) {
  document.querySelectorAll(`[data-like-id="${review.id}"]`).forEach((button) => {
    button.classList.toggle('liked', review.liked_by_me)
    button.setAttribute('aria-label', review.liked_by_me ? '取消点赞' : '点赞')
    const count = button.querySelector('b')
    if (count) count.textContent = review.like_count
  })
}

async function openReviewFromHash() {
  const match = window.location.hash.match(/^#review=([a-zA-Z0-9-]+)$/)
  if (!match) return

  const dialog = document.querySelector('#detailDialog')
  const content = document.querySelector('#detailContent')
  dialog.showModal()
  content.innerHTML = `<div class="detail-loading">${renderSkeletons(1)}</div>`

  try {
    const review =
      state.reviews.find((item) => item.id === match[1]) ??
      (await backend.getReview(match[1]))
    if (!review) throw new Error('这条评价不存在或还未通过审核')
    state.activeReview = review
    const comments = await backend.getComments(review.id)
    content.innerHTML = renderReviewDetail(review, comments)
    bindDetailEvents()
  } catch (error) {
    content.innerHTML = `
      <div class="detail-error">
        <button class="icon-button detail-close" type="button" data-close-dialog>×</button>
        <strong>没找到这份饭评</strong>
        <p>${escapeHtml(humanizeError(error))}</p>
      </div>
    `
  }
}

function renderReviewDetail(review, comments) {
  const rating = getRating(review.rating)
  return `
    <button class="icon-button detail-close" type="button" data-close-dialog aria-label="关闭">×</button>
    <div class="detail-layout" style="--rating-color:${rating.color}">
      <div class="detail-photo">
        <img src="${escapeHtml(review.image_url)}" alt="${escapeHtml(review.dish_name)}">
        <span class="rating-stamp">${rating.label}</span>
      </div>
      <div class="detail-copy">
        <p class="detail-location">${floorLabel(review.floor)} · ${escapeHtml(review.stall)}</p>
        <div class="detail-title">
          <h2>${escapeHtml(review.dish_name)}</h2>
          <strong>${formatPrice(review.price)}</strong>
        </div>
        <blockquote>“${escapeHtml(review.review_text)}”</blockquote>
        <div class="detail-author">
          <span class="avatar">${escapeHtml(review.nickname.slice(0, 1))}</span>
          <b>${escapeHtml(review.nickname)}</b>
          <time>${formatRelativeTime(review.created_at)}</time>
          <button class="like-button ${review.liked_by_me ? 'liked' : ''}" type="button" data-like-id="${review.id}">
            <span>♥</span><b>${review.like_count ?? 0}</b>
          </button>
        </div>
        <button class="share-button" type="button" data-share-id="${review.id}">
          <span aria-hidden="true">↗</span> 分享这份饭评
        </button>

        <section class="comments-section">
          <div class="comments-heading">
            <h3>同学怎么说</h3>
            <span>${comments.length}条已审核评论</span>
          </div>
          <div class="comments-list">
            ${
              comments.length
                ? comments.map(renderComment).join('')
                : '<p class="comments-empty">还没有评论，来当第一个认真说话的人。</p>'
            }
          </div>
          <form class="comment-form" id="commentForm" novalidate>
            <input name="nickname" maxlength="${MAX_NICKNAME_LENGTH}" value="${escapeHtml(state.nickname)}" placeholder="昵称" aria-label="评论昵称">
            <textarea name="body" maxlength="${MAX_COMMENT_LENGTH}" rows="2" placeholder="友善说两句……" aria-label="评论内容"></textarea>
            <div class="comment-form-footer">
              <span>评论审核后公开</span>
              <button type="submit">提交评论</button>
            </div>
            <p class="field-error" id="commentError"></p>
          </form>
        </section>
      </div>
    </div>
  `
}

function renderComment(comment) {
  return `
    <article class="comment">
      <span class="avatar">${escapeHtml(comment.nickname.slice(0, 1))}</span>
      <div>
        <p><b>${escapeHtml(comment.nickname)}</b><time>${formatRelativeTime(comment.created_at)}</time></p>
        <span>${escapeHtml(comment.body)}</span>
      </div>
    </article>
  `
}

function bindDetailEvents() {
  document.querySelector('#commentForm')?.addEventListener('submit', submitComment)
}

async function submitReview(event) {
  event.preventDefault()
  const form = event.currentTarget
  const formData = new FormData(form)
  const input = {
    floor: formData.get('floor'),
    stall: formData.get('stall'),
    dishName: formData.get('dishName'),
    price: formData.get('price'),
    rating: formData.get('rating'),
    reviewText: formData.get('reviewText'),
    nickname: formData.get('nickname'),
    image: formData.get('image'),
  }

  clearFormErrors(form)
  const errors = validateReviewInput(input)
  if (Object.keys(errors).length) {
    showFormErrors(form, errors)
    form.querySelector(`[data-error-for="${Object.keys(errors)[0]}"]`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    })
    return
  }
  if (!formData.get('rulesAccepted')) {
    showToast('请先确认内容发布规则', 'error')
    return
  }

  const submitButton = form.querySelector('[type="submit"]')
  setButtonLoading(submitButton, true, '正在准备照片…')

  try {
    const imageBlob = await getPreparedImage(input.image)
    await withCaptchaRetry(
      () =>
        backend.submitReview(input, imageBlob, (message) => {
          submitButton.textContent = message
        }),
      () => {
        submitButton.textContent = '请先完成人机验证'
      },
    )
    state.nickname = input.nickname.trim()
    localStorage.setItem('canteen-nickname', state.nickname)
    form.reset()
    resetPhotoPreview()
    document.querySelector('#submitDialog').close()
    showToast(
      backend.isDemo ? '演示投稿成功，真实模式下会进入审核队列' : '投稿成功，审核通过后会出现在首页',
      'success',
    )
  } catch (error) {
    showToast(humanizeError(error), 'error')
  } finally {
    setButtonLoading(submitButton, false, '提交审核')
  }
}

async function submitComment(event) {
  event.preventDefault()
  if (!state.activeReview) return

  const form = event.currentTarget
  const formData = new FormData(form)
  const input = {
    nickname: formData.get('nickname'),
    body: formData.get('body'),
  }
  const errors = validateCommentInput(input)
  const errorNode = form.querySelector('#commentError')
  if (Object.keys(errors).length) {
    errorNode.textContent = Object.values(errors)[0]
    return
  }

  const button = form.querySelector('button')
  setButtonLoading(button, true, '提交中…')
  try {
    await withCaptchaRetry(() => backend.submitComment(state.activeReview.id, input))
    state.nickname = input.nickname.trim()
    localStorage.setItem('canteen-nickname', state.nickname)
    form.querySelector('[name="body"]').value = ''
    errorNode.textContent = ''
    showToast(
      backend.isDemo ? '演示评论已提交' : '评论已提交，审核通过后公开',
      'success',
    )
  } catch (error) {
    errorNode.textContent = humanizeError(error)
  } finally {
    setButtonLoading(button, false, '提交评论')
  }
}

async function showPhotoPreview(event) {
  const [file] = event.target.files
  if (!file) return resetPhotoPreview()

  const form = event.target.form
  const imageError = validateImageFile(file)
  const errorNode = form.querySelector('[data-error-for="image"]')
  errorNode.textContent = imageError
  if (imageError) {
    resetPhotoPreview()
    return
  }

  const preparationId = ++state.imagePreparationId
  state.preparedImage = null
  state.imagePreparationError = null
  const preview = document.querySelector('#photoPreview')
  if (preview.src) URL.revokeObjectURL(preview.src)
  preview.src = URL.createObjectURL(file)
  preview.hidden = false
  document.querySelector('#photoLabel').classList.add('has-photo')
  setPhotoStatus('正在优化照片…', 'working')

  state.imagePreparation = compressImage(file)
    .then((blob) => {
      if (preparationId !== state.imagePreparationId) return blob
      state.preparedImage = { file, blob }
      setPhotoStatus(
        `照片已优化：${formatFileSize(file.size)} → ${formatFileSize(blob.size)}`,
        'ready',
      )
      return blob
    })
    .catch((error) => {
      if (preparationId === state.imagePreparationId) {
        state.imagePreparationError = error
        setPhotoStatus('照片处理失败，请重新选择', 'error')
        errorNode.textContent = humanizeError(error)
      }
      return null
    })
}

async function getPreparedImage(file) {
  if (state.preparedImage?.file === file) return state.preparedImage.blob
  if (state.imagePreparation) {
    const blob = await state.imagePreparation
    if (blob) return blob
    throw state.imagePreparationError ?? new Error('照片处理失败，请重新选择')
  }

  state.imagePreparation = compressImage(file)
  return state.imagePreparation
}

function resetPhotoPreview() {
  state.imagePreparationId += 1
  state.preparedImage = null
  state.imagePreparation = null
  state.imagePreparationError = null
  const preview = document.querySelector('#photoPreview')
  if (preview.src) URL.revokeObjectURL(preview.src)
  preview.src = ''
  preview.hidden = true
  document.querySelector('#photoLabel').classList.remove('has-photo')
  setPhotoStatus('')
  document.querySelector('#foodPhoto').value = ''
  document.querySelector('#reviewCounter').textContent = `0/${MAX_REVIEW_LENGTH}`
}

function setPhotoStatus(message, status = '') {
  const node = document.querySelector('#photoStatus')
  node.textContent = message
  node.dataset.status = status
}

function formatFileSize(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function updateReviewCounter(event) {
  document.querySelector('#reviewCounter').textContent =
    `${Array.from(event.target.value).length}/${MAX_REVIEW_LENGTH}`
}

function updateActiveFilter(activeButton) {
  activeButton.parentElement.querySelectorAll('[data-filter]').forEach((button) => {
    button.classList.toggle('active', button === activeButton)
  })
}

function showFormErrors(form, errors) {
  Object.entries(errors).forEach(([field, message]) => {
    const node = form.querySelector(`[data-error-for="${field}"]`)
    if (node) node.textContent = message
  })
}

function clearFormErrors(form) {
  form.querySelectorAll('[data-error-for]').forEach((node) => {
    node.textContent = ''
  })
}

function setButtonLoading(button, loading, label) {
  button.disabled = loading
  button.textContent = label
}

function withCaptchaRetry(operation, onCaptcha = () => {}) {
  return operation().catch(async (error) => {
    if (!(error instanceof CaptchaRequiredError)) throw error
    onCaptcha()
    await showCaptchaGate()
    return operation()
  })
}

function showCaptchaGate() {
  const gate = document.querySelector('#authGate')
  gate.innerHTML = `
    <div class="auth-gate">
      <div class="auth-card">
        <span class="brand-bowl">夯</span>
        <p class="section-kicker">ONE QUICK CHECK</p>
        <h2>先确认你不是自动刷榜程序</h2>
        <p>只需完成一次验证，之后会自动记住这台设备。</p>
        <div id="turnstileWidget"></div>
        <p class="field-error" id="authError"></p>
      </div>
    </div>
  `

  return new Promise((resolve, reject) => {
    let attempts = 0
    const renderWidget = () => {
      if (!window.turnstile) {
        attempts += 1
        if (attempts > 30) {
          const error = new Error('验证组件加载失败，请刷新页面重试')
          document.querySelector('#authError').textContent = error.message
          reject(error)
          return
        }
        window.setTimeout(renderWidget, 200)
        return
      }

      window.turnstile.render('#turnstileWidget', {
        sitekey: turnstileSiteKey,
        theme: 'light',
        callback: async (token) => {
          try {
            await backend.ensureSession(token)
            gate.innerHTML = ''
            resolve()
          } catch (error) {
            document.querySelector('#authError').textContent = humanizeError(error)
            window.turnstile.reset()
          }
        },
      })
    }
    renderWidget()
  })
}

function showFatalError(error) {
  document.querySelector('#reviewGrid').innerHTML = renderLoadError(error)
  showToast(humanizeError(error), 'error')
}

function showToast(message, type = 'info') {
  const region = document.querySelector('#toastRegion')
  const toast = document.createElement('div')
  toast.className = `toast ${type}`
  toast.textContent = message
  region.append(toast)
  window.setTimeout(() => toast.remove(), 4200)
}

async function shareReview(reviewId) {
  const review =
    state.reviews.find((item) => item.id === reviewId) ??
    (state.activeReview?.id === reviewId ? state.activeReview : null)
  if (!review) return

  const url = new URL(window.location.href)
  url.hash = `review=${reviewId}`
  const shareData = {
    title: `${review.dish_name}｜食堂夯榜`,
    text: `${floorLabel(review.floor)} ${review.stall}：${getRating(review.rating).label}`,
    url: url.toString(),
  }

  try {
    if (navigator.share) {
      await navigator.share(shareData)
      return
    }
    await navigator.clipboard.writeText(shareData.url)
    showToast('饭评链接已复制', 'success')
  } catch (error) {
    if (error?.name !== 'AbortError') showToast('分享失败，请稍后重试', 'error')
  }
}

function renderSkeletons(count = 4) {
  return Array.from(
    { length: count },
    () => `
      <article class="review-card skeleton-card" aria-hidden="true">
        <div class="skeleton skeleton-photo"></div>
        <div class="card-body">
          <div class="skeleton skeleton-line short"></div>
          <div class="skeleton skeleton-line"></div>
          <div class="skeleton skeleton-line"></div>
        </div>
      </article>
    `,
  ).join('')
}

function renderEmptyState() {
  return `
    <div class="empty-state">
      <span>空</span>
      <h3>这个筛选下还没有饭评</h3>
      <p>你可以换个条件，或者成为第一个来报饭的人。</p>
      <button type="button" data-open-submit>发布第一条</button>
    </div>
  `
}

function renderLoadError(error) {
  return `
    <div class="empty-state error-state">
      <span>!</span>
      <h3>饭评加载失败</h3>
      <p>${escapeHtml(humanizeError(error))}</p>
      <button type="button" onclick="window.location.reload()">刷新重试</button>
    </div>
  `
}

function ratingDescription(value) {
  return (
    {
      5: '闭眼冲，值得专程上楼',
      4: '稳定发挥，可以回购',
      3: '能吃，下次看心情',
      2: '优点需要仔细寻找',
      1: '帮同学省一次踩雷',
    }[value] ?? ''
  )
}

function clearReviewHash() {
  history.replaceState(null, '', `${window.location.pathname}${window.location.search}`)
  state.activeReview = null
}

function humanizeError(error) {
  const message = error?.message ?? String(error)
  if (message.includes('Failed to fetch')) return '网络连接失败，请稍后重试'
  if (message.includes('row-level security')) return '当前操作没有权限，请刷新后重试'
  if (message.includes('rate limit')) return '操作太频繁，请稍后再试'
  return message
}
