const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const STORAGE_PROVIDER = process.env.MEDIA_STORAGE_PROVIDER || 'local';
const PUBLIC_BASE_URL = process.env.MEDIA_BASE_URL || 'http://localhost:5000';
const LOCAL_UPLOAD_ROOT = path.join(__dirname, '..', 'uploads');

const MIME_EXTENSION_MAP = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'video/x-matroska': '.mkv'
};

function sanitizeBaseName(originalName = '') {
  return path
    .basename(originalName, path.extname(originalName))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40) || 'media';
}

function parseDataUrl(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([a-z0-9.+/-]+);base64,(.+)$/i);
  if (!match) {
    throw new Error('Invalid media payload. Expected a base64 data URL.');
  }

  const mimeType = match[1].toLowerCase();
  const buffer = Buffer.from(match[2], 'base64');
  return { mimeType, buffer };
}

function getMediaType(mimeType) {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  throw new Error('Only image and video uploads are supported.');
}

async function saveLocally(mediaInput, options = {}) {
    const { mimeType, buffer } = parseDataUrl(mediaInput.dataUrl);
    const type = getMediaType(mimeType);
    const allowedTypes = Array.isArray(options.allowedTypes) && options.allowedTypes.length
      ? options.allowedTypes
      : ['image', 'video'];

    if (!allowedTypes.includes(type)) {
      throw new Error(`Only ${allowedTypes.join(' and ')} uploads are supported here.`);
    }

    const extension = MIME_EXTENSION_MAP[mimeType];

  if (!extension) {
    throw new Error(`Unsupported media format: ${mimeType}`);
  }

  const maxBytes = type === 'image' ? 8 * 1024 * 1024 : 25 * 1024 * 1024;
  if (buffer.length > maxBytes) {
    throw new Error(`${type === 'image' ? 'Image' : 'Video'} is too large.`);
  }

  const folder = String(options.folder || 'posts').replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '') || 'posts';
  const filename = `${Date.now()}-${sanitizeBaseName(mediaInput.originalName)}-${crypto.randomBytes(4).toString('hex')}${extension}`;
  const relativePath = path.join(folder, filename).replace(/\\/g, '/');
  const absolutePath = path.join(LOCAL_UPLOAD_ROOT, relativePath);

  await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.promises.writeFile(absolutePath, buffer);

  return {
    type,
    storageProvider: STORAGE_PROVIDER,
    mimeType,
    originalName: mediaInput.originalName || filename,
    size: buffer.length,
    publicId: relativePath,
    url: `${PUBLIC_BASE_URL}/uploads/${relativePath}`
  };
}

async function saveMediaAsset(mediaInput, options = {}) {
  if (STORAGE_PROVIDER !== 'local') {
    throw new Error(`Unsupported MEDIA_STORAGE_PROVIDER: ${STORAGE_PROVIDER}`);
  }

  return saveLocally(mediaInput, options);
}

async function deleteMediaAssets(mediaItems = []) {
  if (STORAGE_PROVIDER !== 'local') return;

  const deletions = mediaItems.map(async media => {
    if (!media || !media.publicId) return;
    const absolutePath = path.join(__dirname, '..', 'uploads', media.publicId);
    try {
      await fs.promises.unlink(absolutePath);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Failed to delete media asset:', absolutePath, error.message);
      }
    }
  });

  await Promise.all(deletions);
}

module.exports = {
  saveMediaAsset,
  deleteMediaAssets
};
