/**
 * 产品配图 URL 解析（与 backend/public/upload/products、picture_url / public_url 字段一致）。
 *
 * 支持存储形态：
 * - `/upload/products/{年号目录}/{序号}.png`（推荐，入库默认）
 * - `upload/products/...`、`backend/public/upload/products/...`、Windows 反斜杠路径
 * - `{年号目录}/{序号}.png` 或仅文件名
 * - `https://...` 外链
 *
 * 生产环境前后端分离且未反代 `/upload` 时，构建配置其一：
 * - VITE_API_BASE_URL=http://your-host:3003/api
 * - VITE_UPLOAD_BASE_URL=http://your-host:3003
 *
 * 若 Nginx 已将 /upload 与 /api 一并反代到后端，可不配置（使用同源相对路径）。
 */

const PRODUCT_PICTURE_URL_PREFIX = '/upload/products'
const LOCAL_FS_PRODUCT_PREFIX = 'backend/public/upload/products/'

function decodeURIComponentSafe(segment) {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

function encodePathnameSegments(pathname) {
  return pathname
    .split('/')
    .map((seg) => (seg ? encodeURIComponent(decodeURIComponentSafe(seg)) : ''))
    .join('/') || '/'
}

/** 静态文件服务根（不含末尾斜杠）；空字符串表示与当前站点同源 */
export function getProductPictureStaticOrigin() {
  const uploadBase = import.meta.env.VITE_UPLOAD_BASE_URL
  if (uploadBase && String(uploadBase).trim()) {
    return String(uploadBase).trim().replace(/\/$/, '')
  }
  const apiBase = import.meta.env.VITE_API_BASE_URL
  if (apiBase && String(apiBase).trim()) {
    return String(apiBase)
      .trim()
      .replace(/\/api\/?$/i, '')
      .replace(/\/$/, '')
  }
  return ''
}

/** 将库表/接口中的原始路径规范为浏览器可访问的 pathname（以 / 开头）或完整 URL */
export function normalizeProductPicturePath(raw) {
  const s = String(raw ?? '').trim()
  if (!s) return ''
  if (/^https?:\/\//i.test(s)) return s
  if (/^\/\//.test(s)) {
    const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:'
    return `${protocol}${s}`
  }

  const normalized = s.replace(/\\/g, '/').replace(/^\/+/, '')
  if (normalized.startsWith('upload/products/') || normalized.startsWith('upload/')) {
    return `/${normalized}`
  }
  if (normalized.startsWith(LOCAL_FS_PRODUCT_PREFIX)) {
    return `/${normalized.slice('backend/public/'.length)}`
  }
  return `${PRODUCT_PICTURE_URL_PREFIX}/${normalized}`
}

/** 列表/预览用：el-image :src */
export function resolveProductPictureSrc(raw) {
  const normalized = normalizeProductPicturePath(raw)
  if (!normalized) return ''
  if (/^https?:\/\//i.test(normalized)) return normalized

  const pathOnly = normalized.startsWith('/') ? normalized : `/${normalized}`
  const encodedPath = encodePathnameSegments(pathOnly)
  const origin = getProductPictureStaticOrigin()

  if (!origin) {
    return encodedPath
  }

  try {
    const base = origin.replace(/\/$/, '')
    return new URL(encodedPath, base).href
  } catch {
    return `${origin}${encodedPath}`
  }
}

/** 打包下载 fetch 用：保证为可请求的绝对 URL */
export function resolveProductPictureAbsoluteUrl(raw) {
  const src = resolveProductPictureSrc(raw)
  if (!src) return ''
  if (/^https?:\/\//i.test(src)) return src
  if (typeof window === 'undefined') return src

  try {
    return new URL(src, window.location.origin).href
  } catch {
    return ''
  }
}

export function getProductPictureStoredPath(row) {
  return String(row?.picture_url ?? row?.public_url ?? '').trim()
}

export function resolveProductPictureSrcFromRow(row) {
  return resolveProductPictureSrc(getProductPictureStoredPath(row))
}

/** 抽象产品等场景：picture_url / image_url 均可解析 */
export function resolveProductPictureSrcFromImageFields(row) {
  const raw = String(row?.picture_url ?? row?.image_url ?? row?.public_url ?? '').trim()
  return resolveProductPictureSrc(raw)
}

export function formatProductPictureFileSize(bytes) {
  const n = Number(bytes) || 0
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

/** 与 data_get/get_eatting announcement_picture_folder_slug / 后端 upload 接口对齐 */
export function normalizeProductPictureFolderWhitespace(value) {
  return String(value ?? '').replace(/\u0007/g, ' ').replace(/[ \t]+/g, ' ').trim()
}

export function sanitizeProductPictureFolderSlug(folderKeyRaw) {
  const raw = normalizeProductPictureFolderWhitespace(folderKeyRaw)
  if (!raw) return 'misc'
  let text = raw.replace(/[/\\:*?"<>|]+/g, '_')
  text = text.replace(/_+/g, '_').replace(/^[.\s_]+|[.\s_]+$/g, '')
  if (!text) return 'misc'
  const limited = text.slice(0, 120)
  const slug = limited || 'announcement'
  if (slug === 'announcement') return 'misc'
  return slug
}

/** 构建批量上传预览行（与核验工作台 productImageFileRows 一致） */
export function buildProductPictureUploadPreviewRows(files, { startSequence = 1, folderSlug = 'misc' } = {}) {
  const start = Math.max(Number(startSequence || 1), 1)
  const slug = String(folderSlug || 'misc')
  const list = Array.isArray(files) ? files : []
  return list.map((item, index) => {
    const sequenceNo = start + index
    const targetName = `${sequenceNo}.png`
    return {
      ...item,
      sequenceNo,
      targetName,
      targetPath: `backend\\public\\upload\\products\\${slug}\\${targetName}`,
      sizeLabel: formatProductPictureFileSize(item.size)
    }
  })
}
