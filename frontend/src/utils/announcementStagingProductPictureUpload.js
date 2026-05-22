/**
 * 临时表/分类管理共用：POST `/announcement-staging/product-images/upload`
 * （与 CategoryManage 抽象 product 单行选图、核验工作台批量/单行上传一致）。
 */
import { uploadAnnouncementStagingProductImages } from '@/api/index'

/** @param {{ file: File, name?: string }[]} fileRows */
export function appendFilesToAnnouncementStagingProductImageForm(formData, fileRows) {
  const list = Array.isArray(fileRows) ? fileRows : []
  for (const row of list) {
    const f = row?.file
    if (!f) continue
    formData.append('files', f, row.name || f.name || 'image.png')
  }
}

/**
 * @param {{ file: File, name?: string }[]} fileRows
 * @param {{ startSequence?: number, announcementNo?: string, announcementId?: number | null, stagingBatchId?: number | null }} options
 */
export function buildAnnouncementStagingProductImageFormData(fileRows, options = {}) {
  const formData = new FormData()
  appendFilesToAnnouncementStagingProductImageForm(formData, fileRows)
  const start = Math.max(Number(options.startSequence) || 1, 1)
  formData.append('start_sequence', String(start))
  formData.append('announcement_no', String(options.announcementNo ?? '').trim())
  const aid = Number(options.announcementId)
  if (Number.isInteger(aid) && aid > 0) {
    formData.append('announcement_id', String(aid))
  }
  const sid = Number(options.stagingBatchId)
  if (Number.isInteger(sid) && sid > 0) {
    formData.append('staging_batch_id', String(sid))
  }
  return formData
}

/**
 * @param {{ file: File, name?: string }[]} fileRows
 * @param {{ startSequence?: number, announcementNo?: string, announcementId?: number | null, stagingBatchId?: number | null }} options
 * @param {(fd: FormData) => Promise<Record<string, unknown>>} uploadFn
 */
export async function postAnnouncementStagingProductImages(fileRows, options = {}, uploadFn = uploadAnnouncementStagingProductImages) {
  const formData = buildAnnouncementStagingProductImageFormData(fileRows, options)
  return uploadFn(formData)
}

export function getAnnouncementStagingUploadItems(res) {
  const data = res?.data ?? {}
  const items = data.items
  return Array.isArray(items) ? items : []
}

export function getFirstAnnouncementStagingUploadedPictureStoredPath(res) {
  const first = getAnnouncementStagingUploadItems(res)[0]
  return String(first?.picture_url || first?.public_url || '').trim()
}
