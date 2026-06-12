import { MAX_IMAGE_EDGE } from './constants.js'

export async function compressImage(file) {
  const image = await decodeImage(file)
  const { width, height } = getTargetSize(image.width, image.height)

  try {
    if (
      file.type === 'image/webp' &&
      width === image.width &&
      height === image.height &&
      file.size <= 1024 * 1024
    ) {
      return file
    }

    if (
      'OffscreenCanvas' in window &&
      typeof OffscreenCanvas.prototype.convertToBlob === 'function'
    ) {
      const canvas = new OffscreenCanvas(width, height)
      drawImage(canvas, image.source, width, height)
      return await canvas.convertToBlob({ type: 'image/webp', quality: 0.8 })
    }

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    drawImage(canvas, image.source, width, height)

    return await new Promise((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('图片压缩失败'))),
        'image/webp',
        0.8,
      )
    })
  } finally {
    image.dispose()
  }
}

export function getTargetSize(width, height) {
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function drawImage(canvas, image, width, height) {
  const context = canvas.getContext('2d', { alpha: false })
  if (!context) throw new Error('当前浏览器无法处理图片')

  context.fillStyle = '#ffffff'
  context.fillRect(0, 0, width, height)
  context.drawImage(image, 0, 0, width, height)
}

async function decodeImage(file) {
  if ('createImageBitmap' in window) {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return {
        source: bitmap,
        width: bitmap.width,
        height: bitmap.height,
        dispose: () => bitmap.close(),
      }
    } catch {
      // Some older mobile browsers expose createImageBitmap but cannot decode every JPEG.
    }
  }

  return loadHtmlImage(file)
}

function loadHtmlImage(file) {
  return new Promise((resolve, reject) => {
    const sourceUrl = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () =>
      resolve({
        source: image,
        width: image.naturalWidth,
        height: image.naturalHeight,
        dispose: () => URL.revokeObjectURL(sourceUrl),
      })
    image.onerror = () => {
      URL.revokeObjectURL(sourceUrl)
      reject(new Error('无法读取这张图片'))
    }
    image.src = sourceUrl
  })
}
