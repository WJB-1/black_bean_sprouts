import * as Minio from "minio";

export type StorageService = {
  putObject(key: string, body: Buffer, contentType: string): Promise<void>;
  getSignedUrl(key: string, expiresSeconds: number): Promise<string>;
  removeObject(key: string): Promise<void>;
};

export async function createStorageService(): Promise<StorageService> {
  const client = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || "localhost",
    port: parseInt(process.env.MINIO_PORT || "9000", 10),
    accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    useSSL: process.env.MINIO_USE_SSL === "true",
  });
  const bucket = process.env.MINIO_BUCKET || "black-bean-sprouts";

  const exists = await client.bucketExists(bucket);
  if (!exists) {
    await client.makeBucket(bucket);
  }

  return {
    async putObject(key, body, contentType) {
      await client.putObject(bucket, key, body, body.length, { "Content-Type": contentType });
    },
    async getSignedUrl(key, expiresSeconds) {
      return client.presignedGetObject(bucket, key, expiresSeconds);
    },
    async removeObject(key) {
      await client.removeObject(bucket, key);
    },
  };
}
