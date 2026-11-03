import multer from 'multer';
import { AppError } from './errorHandler.js';

// Use memory storage so we can stream directly to Cloudinary without writing to disk
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  // Accept standard image MIME types
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/avif',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        'Invalid file type. Only JPEG, PNG, WEBP, GIF, and AVIF images are permitted.',
        400
      ),
      false
    );
  }
};

export const uploadSingleImage = multer({
  storage,
  limits: {
    fileSize: 8 * 1024 * 1024, // 8MB limit
  },
  fileFilter,
}).single('image');

export default uploadSingleImage;
