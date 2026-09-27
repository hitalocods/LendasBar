import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "tu1laexi",
  api_key: process.env.CLOUDINARY_API_KEY || "591786692586619",
  api_secret: process.env.CLOUDINARY_API_SECRET || "9SCmn77ZThGZoXjxI1GIyWdcv00",
  secure: true
});

export async function uploadToCloudinary(
  fileBuffer: Buffer,
  folder = "lendas"
): Promise<{ url: string; publicId: string }> {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "auto"
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error("Cloudinary upload failed"));
        } else {
          resolve({
            url: result.secure_url,
            publicId: result.public_id
          });
        }
      }
    );
    uploadStream.end(fileBuffer);
  });
}

export { cloudinary };
