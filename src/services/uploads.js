const crypto = require('crypto');
const { DeleteObjectCommand, PutObjectCommand, S3Client } = require('@aws-sdk/client-s3');
const sharp = require('sharp');
const config = require('../config');
const { HttpError } = require('../utils');

const MAX_PHOTOS = 4;
const MAX_WIDTH = 1600;
const JPEG_QUALITY = 80;

let s3Client = null;

const publicBaseUrl = () => {
  if (config.s3Bucket && config.awsRegion) {
    return `https://${config.s3Bucket}.s3.${config.awsRegion}.amazonaws.com`;
  }
  return String(config.s3PublicBaseUrl || '').replace(/\/$/, '');
};

const isS3Configured = () =>
  Boolean(config.awsAccessKeyId && config.awsSecretAccessKey && config.s3Bucket && config.awsRegion);

const mapS3Error = error => {
  const name = String(error?.name || error?.Code || '');
  const message = String(error?.message || '');
  if (name === 'PermanentRedirect' || /specified endpoint/i.test(message)) {
    return new HttpError(
      503,
      `S3 bucket region does not match AWS_REGION (${config.awsRegion}). Set AWS_REGION to the bucket's region.`,
    );
  }
  if (name === 'InvalidAccessKeyId' || name === 'SignatureDoesNotMatch' || name === 'AccessDenied') {
    return new HttpError(
      503,
      'S3 credentials were rejected. Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and bucket IAM permissions.',
    );
  }
  if (name === 'NoSuchBucket') {
    return new HttpError(503, `S3 bucket "${config.s3Bucket}" was not found.`);
  }
  return new HttpError(502, message || 'Could not upload photos to storage');
};

const getS3 = () => {
  if (!isS3Configured()) {
    throw new HttpError(503, 'Image storage is not configured. Set AWS S3 environment variables.');
  }
  if (!s3Client) {
    s3Client = new S3Client({
      region: config.awsRegion,
      credentials: {
        accessKeyId: config.awsAccessKeyId,
        secretAccessKey: config.awsSecretAccessKey,
      },
    });
  }
  return s3Client;
};

const isPlaceholderPhoto = url => /picsum\.photos/i.test(String(url || ''));

const photoKeyFromUrl = (url, prefix = '') => {
  try {
    const parsed = new URL(String(url || ''));
    const bucket = String(parsed.hostname || '').split('.s3')[0];
    if (config.s3Bucket && bucket !== config.s3Bucket) return null;
    const key = decodeURIComponent(parsed.pathname.replace(/^\//, ''));
    if (prefix) return key.startsWith(prefix) ? key : null;
    if (key.startsWith('toilets/') || key.startsWith('profiles/')) return key;
    return null;
  } catch {
    return null;
  }
};

const isStoredPhotoUrl = url => Boolean(photoKeyFromUrl(url, 'toilets/'));
const isStoredProfilePhotoUrl = url => Boolean(photoKeyFromUrl(url, 'profiles/'));

const publicUrlForKey = key => `${publicBaseUrl()}/${key}`;

const rewritePublicPhotoUrl = url => {
  const key = photoKeyFromUrl(url);
  return key ? publicUrlForKey(key) : url;
};

const removedPhotoUrls = (previous = [], next = []) => {
  const keep = new Set((next || []).map(photoKeyFromUrl).filter(Boolean));
  return (previous || []).filter(url => {
    const key = photoKeyFromUrl(url);
    return Boolean(key) && !keep.has(key);
  });
};

const rewritePhotoList = photos =>
  (Array.isArray(photos) ? photos : []).map(item => rewritePublicPhotoUrl(item)).filter(Boolean);

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
    try {
      await client.send(
        new PutObjectCommand({
          Bucket: config.s3Bucket,
          Key: key,
          Body: compressed,
          ContentType: 'image/jpeg',
          CacheControl: 'public, max-age=31536000',
        }),
      );
    } catch (error) {
      throw mapS3Error(error);
    }
    urls.push(publicUrlForKey(key));
  }

  return urls;
};

const uploadProfilePhoto = async ({ userId, file }) => {
  if (!file?.buffer) {
    throw new HttpError(400, 'Add a profile photo');
  }
  const compressed = await compressImage(file.buffer);
  const key = `profiles/${userId}/${crypto.randomUUID()}.jpg`;
  try {
    await getS3().send(
      new PutObjectCommand({
        Bucket: config.s3Bucket,
        Key: key,
        Body: compressed,
        ContentType: 'image/jpeg',
        CacheControl: 'public, max-age=31536000',
      }),
    );
  } catch (error) {
    throw mapS3Error(error);
  }
  return publicUrlForKey(key);
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
  return rewritePhotoList(list);
};

const normalizeProfilePhotoUrl = (value, { allowEmpty = true } = {}) => {
  if (value == null) return undefined;
  const photoUrl = String(value).trim();
  if (!photoUrl) {
    if (!allowEmpty) throw new HttpError(400, 'Add a profile photo');
    return '';
  }
  if (!isStoredProfilePhotoUrl(photoUrl)) {
    throw new HttpError(400, 'Photo must be uploaded through this app');
  }
  return rewritePublicPhotoUrl(photoUrl);
};

module.exports = {
  MAX_PHOTOS,
  isS3Configured,
  isPlaceholderPhoto,
  isStoredPhotoUrl,
  isStoredProfilePhotoUrl,
  uploadToiletPhotos,
  uploadProfilePhoto,
  deletePhotoUrls,
  normalizePhotoList,
  normalizeProfilePhotoUrl,
  rewritePhotoList,
  rewritePublicPhotoUrl,
  removedPhotoUrls,
};
