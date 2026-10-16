import "server-only";
import { v2 as cloudinary } from "cloudinary";
import { ALLOWED_IMAGE_FORMATS, PRODUCT_IMAGE_FOLDER } from "@/lib/cloudinary-validation";

/** Credentials from the server environment. The API secret never leaves this module. */
function credentials() {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloudName, apiKey, apiSecret };
}

export function getCloudName() {
  return credentials()?.cloudName ?? "";
}

/** Signature for one direct browser upload into the product folder. */
export function signProductUpload() {
  const creds = credentials();
  if (!creds) return null;
  const timestamp = Math.round(Date.now() / 1000);
  const params = {
    allowed_formats: ALLOWED_IMAGE_FORMATS,
    folder: PRODUCT_IMAGE_FOLDER,
    timestamp,
  };
  const signature = cloudinary.utils.api_sign_request(params, creds.apiSecret);
  // apiKey is public by design; apiSecret is not returned.
  return { ...params, signature, apiKey: creds.apiKey, cloudName: creds.cloudName };
}

/**
 * Best-effort delete of files from Cloudinary. Failures are logged, never thrown,
 * so a Cloudinary outage cannot block a database change.
 */
export async function destroyImages(publicIds: string[]) {
  if (publicIds.length === 0) return;
  const creds = credentials();
  if (!creds) {
    console.error("Cloudinary is not configured; skipped deleting", publicIds);
    return;
  }
  cloudinary.config({
    cloud_name: creds.cloudName,
    api_key: creds.apiKey,
    api_secret: creds.apiSecret,
    secure: true,
  });
  await Promise.all(
    publicIds.map(async (publicId) => {
      try {
        const res = await cloudinary.uploader.destroy(publicId, { invalidate: true });
        if (res.result !== "ok" && res.result !== "not found") {
          console.error("Cloudinary destroy returned", res.result, publicId);
        }
      } catch (error) {
        console.error("Cloudinary destroy failed", publicId, error);
      }
    }),
  );
}
