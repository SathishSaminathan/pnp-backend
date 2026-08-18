const crypto = require('crypto');
const { DeleteObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const config = require('../config');
const { HttpError } = require('../utils');

const MAX_PHOTOS = 4;
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 80;

let s3Client = null;

const publicBaseUrl = () => String(config.s3PublicBaseUrl || '').replace(/\/$/, '');

const isS3Configured = () =>
  Boolean(config.awsAccessKeyId && config.awsSecretAccessKey && config.s3Bucket && config.awsRegion);

const getS3 = () => {
  if (!isS3Configured()) {
    throw new HttpError(503, 'Image storage is not configured. Set AWS S3 environment variables.');
  }
  if (!s3Client) {
    const clientConfig = {
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    };
    if (config.s3Endpoint) {
      clientConfig.endpoint = config.s3Endpoint;
      clientConfig.forcePathStyle = true;
    }
    s3Client = new S3Client(clientConfig);
  }
  return s3Client;
};

const isPlaceholderPhoto = url => /picsum\.photos/i.test(String(url || ''));

const photoKeyFromUrl = url => {
  const base = publicBaseUrl();
  const value = String(url || '');
  if (!base || !value.startsWith(`${base}/`)) return null;
  try {
    const { pathname } = new URL(value);
    const key = decodeURIComponent(pathname.replace(/^\//, ''));
    return key.startsWith('toilets/') ? key : null;
  } catch {
    return null;
  }
};

const isStoredPhotoUrl = url => Boolean(photoKeyFromUrl(url));

const publicUrlForKey = key => `${publicBaseUrl()}/${key}`;

const compressImage = async buffer => {
  try {
    return await sharp(buffer)
      .rotate()
      .resize({ width: MAX_WIDTH, withoutEnlargement: true })
      .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new HttpError(400, 'Could not process one of the images. Use JPEG, PNG, or WebP.');
  }
};

const uploadToiletPhotos = async ({ userId, files = [] }) => {
  if (!files.length) {
    throw new HttpError(400, 'Add at least one photo');
  }
  if (files.length > MAX_PHOTOS) {
    throw new HttpError(400, `You can upload up to ${MAX_PHOTOS} photos`);
  }

  const client = getS3();
  const urls = [];

  for (const file of files) {
    const compressed = await compressImage(file.buffer);
    const key = `toilets/${userId}/${crypto.randomUUID()}.jpg`;
    await client.send(
      new PutObjectCommand({
        Bucket: config.s3Bucket,
        Key: key,
        Body: compressed,
        ContentType: 'image/jpeg',
        CacheControl: 'public, max-age=31536000',
      }),
    );
    urls.push(publicUrlForKey(key));
  }

  return urls;
};

const deletePhotoUrls = async urls => {
  const keys = [...new Set((urls || []).map(photoKeyFromUrl).filter(Boolean))];
  if (!keys.length || !isS3Configured()) return;
  const client = getS3();
  await Promise.all(
    keys.map(key =>
      client.send(new DeleteObjectCommand({ Bucket: config.s3Bucket, Key: key })).catch(error => {
        console.warn('Failed to delete S3 object', key, error.message);
      }),
    ),
  );
};

const normalizePhotoList = (photos, { required = false } = {}) => {
  const list = Array.isArray(photos) ? photos.map(item => String(item || '').trim()).filter(Boolean) : [];
  if (required && !list.length) {
    throw new HttpError(400, 'Add at least one photo');
  }
  if (list.length > MAX_PHOTOS) {
    throw new HttpError(400, `You can add up to ${MAX_PHOTOS} photos`);
  }
  const invalid = list.filter(url => !isStoredPhotoUrl(url) && !isPlaceholderPhoto(url));
  if (invalid.length) {
    throw new HttpError(400, 'Photos must be uploaded through this app');
  }
  return list;
};

module.exports = {
  MAX_PHOTOS,
  isS3Configured,
  isPlaceholderPhoto,
  isStoredPhotoUrl,
  uploadToiletPhotos,
  deletePhotoUrls,
  normalizePhotoList,
};
