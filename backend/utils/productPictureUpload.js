const fs = require('fs');
const path = require('path');

const PRODUCT_IMAGE_UPLOAD_DIR = path.join(__dirname, '..', 'public', 'upload', 'products');

function normalizeFolderWhitespace(value) {
  return String(value ?? '')
    .replace(/\u0007/g, ' ')
    .replace(/[\t ]+/g, ' ')
    .trim();
}

/** 与前端 productPicture.sanitizeProductPictureFolderSlug / 通告导入目录规则一致 */
function sanitizeProductPictureFolderSlug(folderKeyRaw) {
  const raw = normalizeFolderWhitespace(folderKeyRaw);
  if (!raw) {
    return 'misc';
  }
  let text = raw.replace(/[\\/:*?"<>|]+/g, '_');
  text = text.replace(/_+/g, '_').replace(/^[.\s_]+|[.\s_]+$/g, '');
  if (!text) {
    return 'misc';
  }
  const limited = text.slice(0, 120);
  const slug = limited || 'announcement';
  if (slug === 'announcement') {
    return 'misc';
  }
  return slug;
}

/** 抽象产品配图：按产品名称命名文件（固定 .png） */
function sanitizeProductPictureFileName(nameRaw) {
  const raw = normalizeFolderWhitespace(nameRaw);
  if (!raw) {
    const error = new Error('产品名称不能为空');
    error.statusCode = 400;
    throw error;
  }
  let text = raw.replace(/[\\/:*?"<>|]+/g, '_');
  text = text.replace(/_+/g, '_').replace(/^[.\s_]+|[.\s_]+$/g, '');
  if (!text) {
    const error = new Error('产品名称无效，无法生成文件名');
    error.statusCode = 400;
    throw error;
  }
  return `${text.slice(0, 120)}.png`;
}

function buildProductPicturePublicUrl(folderSlug, fileName) {
  return `/upload/products/${folderSlug}/${fileName}`;
}

function buildProductPictureItem(folderSlug, fileName, file, reused = false) {
  const publicUrl = buildProductPicturePublicUrl(folderSlug, fileName);
  return {
    sequence_no: null,
    original_name: file?.originalname,
    file_name: fileName,
    relative_path: `backend\\public\\upload\\products\\${folderSlug}\\${fileName}`,
    picture_url: publicUrl,
    public_url: publicUrl,
    image_url: publicUrl,
    bytes: file?.size,
    reused
  };
}

/** 将库表/前端传入路径规范为 /upload/products/... 形式 */
function normalizeStoredProductPictureUrl(raw) {
  const text = String(raw ?? '').trim();
  if (!text) return '';
  if (/^https?:\/\//i.test(text)) return text;
  const normalized = text.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalized.startsWith('upload/products/') || normalized.startsWith('upload/')) {
    return `/${normalized}`;
  }
  if (normalized.startsWith('backend/public/upload/products/')) {
    return `/${normalized.slice('backend/public/'.length)}`;
  }
  if (normalized.startsWith('public/upload/products/')) {
    return `/${normalized.slice('public/'.length)}`;
  }
  return `/upload/products/${normalized.replace(/^upload\/products\/?/i, '')}`;
}

function resolveAbsoluteProductPicturePath(publicUrl) {
  const normalized = normalizeStoredProductPictureUrl(publicUrl);
  if (!normalized || /^https?:\/\//i.test(normalized)) return '';
  const relative = normalized.replace(/^\/upload\/products\/?/i, '');
  if (!relative) return '';
  const segments = relative.split('/').filter(Boolean);
  return path.join(PRODUCT_IMAGE_UPLOAD_DIR, ...segments);
}

function productPictureFileExists(publicUrl) {
  const absolutePath = resolveAbsoluteProductPicturePath(publicUrl);
  return Boolean(absolutePath && fs.existsSync(absolutePath));
}

function ensureProductImageUploadDir() {
  fs.mkdirSync(PRODUCT_IMAGE_UPLOAD_DIR, { recursive: true });
}

/** 抽象产品目录：仅按所属分类命名 */
function buildAbstractProductCategoryFolderKey(categoryName) {
  return normalizeFolderWhitespace(categoryName);
}

/**
 * @param {{
 *   folderKey: string,
 *   files: { buffer: Buffer, originalname?: string, size?: number }[],
 *   startSequence?: number,
 *   fileNames?: (string|null|undefined)[]
 * }} options
 */
function saveProductPictureFiles({ folderKey, files, startSequence = 1, fileNames = null }) {
  const normalizedKey = normalizeFolderWhitespace(folderKey);
  if (!normalizedKey) {
    const error = new Error('目录标识不能为空');
    error.statusCode = 400;
    throw error;
  }

  ensureProductImageUploadDir();
  const folderSlug = sanitizeProductPictureFolderSlug(normalizedKey);
  const batchDir = path.join(PRODUCT_IMAGE_UPLOAD_DIR, folderSlug);
  fs.mkdirSync(batchDir, { recursive: true });

  const start = Math.max(Number.parseInt(String(startSequence), 10) || 1, 1);
  const list = Array.isArray(files) ? files : [];
  const nameList = Array.isArray(fileNames) ? fileNames : [];
  const items = [];

  list.forEach((file, index) => {
    const sequenceNo = start + index;
    const fileName = nameList[index]
      ? sanitizeProductPictureFileName(String(nameList[index]).replace(/\.png$/i, ''))
      : `${sequenceNo}.png`;
    const absolutePath = path.join(batchDir, fileName);
    const reused = fs.existsSync(absolutePath);
    if (!reused) {
      fs.writeFileSync(absolutePath, file.buffer);
    }
    items.push({
      ...buildProductPictureItem(folderSlug, fileName, file, reused),
      sequence_no: sequenceNo
    });
  });

  return {
    folder_key: normalizedKey,
    folder_slug: folderSlug,
    items
  };
}

module.exports = {
  PRODUCT_IMAGE_UPLOAD_DIR,
  normalizeFolderWhitespace,
  sanitizeProductPictureFolderSlug,
  sanitizeProductPictureFileName,
  ensureProductImageUploadDir,
  buildAbstractProductCategoryFolderKey,
  buildProductPicturePublicUrl,
  normalizeStoredProductPictureUrl,
  resolveAbsoluteProductPicturePath,
  productPictureFileExists,
  saveProductPictureFiles
};
