import { v2 as cloudinary } from 'cloudinary';
import { Readable } from 'stream';
import env from './env.js';
import logger from '../utils/logger.js';

cloudinary.config({
  cloud_name: env.cloudinary.cloudName,
  api_key: env.cloudinary.apiKey,
  api_secret: env.cloudinary.apiSecret,
});

/**
 * Uploads an image buffer directly to Cloudinary
 * @param {Buffer} buffer File buffer from Multer
 * @param {string} folder Target folder in Cloudinary
 * @returns {Promise<{ secure_url: string, public_id: string }>}
 */
export function uploadImageBuffer(buffer, folder = 'ecommerce/products') {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: 'image',
      },
      (error, result) => {
        if (error) {
          logger.error({ err: error.message }, 'Failed to upload image to Cloudinary');
          return reject(error);
        }
        logger.info(
          { public_id: result.public_id, secure_url: result.secure_url },
          'Successfully uploaded image to Cloudinary'
        );
        resolve({
          secure_url: result.secure_url,
          public_id: result.public_id,
        });
      }
    );

    Readable.from(buffer).pipe(uploadStream);
  });
}

/**
 * Extracts the public_id from a Cloudinary image URL
 * @param {string} url Cloudinary image URL
 * @returns {string|null}
 */
export function extractPublicId(url) {
  if (!url || typeof url !== 'string' || !url.includes('cloudinary.com')) {
    return null;
  }
  try {
    const uploadIdx = url.indexOf('/upload/');
    if (uploadIdx === -1) return null;

    let path = url.slice(uploadIdx + '/upload/'.length);
    // Strip leading version tag if present (e.g., v1730268000/)
    path = path.replace(/^v\d+\//, '');
    // Strip file extension (e.g., .jpg, .png, .webp)
    const lastDot = path.lastIndexOf('.');
    if (lastDot !== -1) {
      path = path.substring(0, lastDot);
    }
    return path;
  } catch (err) {
    logger.warn({ url, err: err.message }, 'Could not parse public_id from Cloudinary URL');
    return null;
  }
}

/**
 * Deletes an image from Cloudinary by public_id or image URL
 * @param {string} publicIdOrUrl
 * @returns {Promise<boolean>}
 */
export async function deleteCloudinaryImage(publicIdOrUrl) {
  if (!publicIdOrUrl || typeof publicIdOrUrl !== 'string') return false;

  let publicId = null;

  // If input is a URL (contains http or cloudinary.com)
  if (publicIdOrUrl.startsWith('http://') || publicIdOrUrl.startsWith('https://') || publicIdOrUrl.includes('cloudinary.com')) {
    publicId = extractPublicId(publicIdOrUrl);
  } else {
    // Input is a direct public_id identifier (e.g. ecommerce/products/abc123xyz)
    const trimmed = publicIdOrUrl.trim();
    // Validate that it looks like a valid Cloudinary public_id and not an arbitrary human title
    if (!trimmed.includes(' ') && (trimmed.includes('/') || /^[a-zA-Z0-9_-]{10,}$/.test(trimmed))) {
      publicId = trimmed;
    }
  }

  if (!publicId) {
    logger.debug({ target: publicIdOrUrl }, 'No valid Cloudinary public_id found to delete');
    return false;
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId);
    logger.info({ publicId, result }, 'Cloudinary image destroy result');
    return result.result === 'ok' || result.result === 'not found';
  } catch (error) {
    logger.error({ publicId, err: error.message }, 'Error deleting image from Cloudinary');
    return false;
  }
}

export default {
  cloudinary,
  uploadImageBuffer,
  extractPublicId,
  deleteCloudinaryImage,
};
