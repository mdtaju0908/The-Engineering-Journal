const cloudinary = require('cloudinary').v2;
let CloudinaryStorage;
try {
  const multerCloudinary = require('multer-storage-cloudinary');
  // Check if it's version 4+ (object with CloudinaryStorage property) or older (function)
  if (multerCloudinary.CloudinaryStorage) {
    CloudinaryStorage = multerCloudinary.CloudinaryStorage;
  } else {
    CloudinaryStorage = multerCloudinary;
  }
} catch (err) {
  console.error('Error loading multer-storage-cloudinary:', err.message);
}
const multer = require('multer');
const dotenv = require('dotenv');

dotenv.config();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_API_KEY || process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET || process.env.CLOUDINARY_SECRET,
});

let upload;
let USING_CLOUDINARY_STORAGE = false;

try {
  if (CloudinaryStorage) {
    const storage = new CloudinaryStorage({
      cloudinary: cloudinary,
      params: {
        folder: 'portfolio_uploads',
        allowed_formats: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'mp4', 'webm', 'mov', 'm4v'],
        resource_type: 'auto',
      },
    });
    upload = multer({ storage });
    USING_CLOUDINARY_STORAGE = true;
  } else {
    console.warn('Falling back to memory storage');
    upload = multer({ storage: multer.memoryStorage() });
  }
} catch (err) {
  console.error('Multer setup error:', err.message);
  upload = multer({ storage: multer.memoryStorage() });
}

module.exports = { cloudinary, upload, USING_CLOUDINARY_STORAGE };

export {};
