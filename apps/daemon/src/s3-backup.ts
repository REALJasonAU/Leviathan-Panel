import fs from "node:fs";
import path from "node:path";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

type S3Target = {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
  pathPrefix: string;
  forcePathStyle?: boolean;
};

export const createS3Client = (target: S3Target) =>
  new S3Client({
    endpoint: target.endpoint,
    region: target.region,
    forcePathStyle: target.forcePathStyle,
    credentials: {
      accessKeyId: target.accessKeyId,
      secretAccessKey: target.secretAccessKey,
    },
  });

export const buildBackupObjectKey = (
  target: S3Target,
  serverId: string,
  backupId: string,
  fileName: string,
) =>
  path.posix.join(
    target.pathPrefix || "leviathan/backups",
    serverId,
    `${backupId}-${fileName}`,
  );

export const uploadBackupToS3 = async (input: {
  target: S3Target;
  serverId: string;
  backupId: string;
  filePath: string;
}) => {
  const client = createS3Client(input.target);
  const fileName = path.basename(input.filePath);
  const objectKey = buildBackupObjectKey(
    input.target,
    input.serverId,
    input.backupId,
    fileName,
  );
  await client.send(
    new PutObjectCommand({
      Bucket: input.target.bucket,
      Key: objectKey,
      Body: fs.createReadStream(input.filePath),
    }),
  );
  const stats = await fs.promises.stat(input.filePath);
  return { objectKey, sizeBytes: stats.size };
};

export const downloadBackupFromS3 = async (input: {
  target: S3Target;
  objectKey: string;
  destinationPath: string;
}) => {
  const client = createS3Client(input.target);
  const response = await client.send(
    new GetObjectCommand({
      Bucket: input.target.bucket,
      Key: input.objectKey,
    }),
  );
  const body = response.Body;
  if (!body) {
    throw new Error("S3 response did not include a readable stream");
  }
  await fs.promises.mkdir(path.dirname(input.destinationPath), {
    recursive: true,
  });
  if ("transformToByteArray" in body) {
    const bytes = await body.transformToByteArray();
    await fs.promises.writeFile(input.destinationPath, Buffer.from(bytes));
    return { filePath: input.destinationPath };
  }
  const stream = body as NodeJS.ReadableStream;
  await new Promise<void>((resolve, reject) => {
    const writer = fs.createWriteStream(input.destinationPath);
    stream.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });
  return { filePath: input.destinationPath };
};

export const deleteBackupFromS3 = async (input: {
  target: S3Target;
  objectKey: string;
}) => {
  const client = createS3Client(input.target);
  await client.send(
    new DeleteObjectCommand({
      Bucket: input.target.bucket,
      Key: input.objectKey,
    }),
  );
  return { deleted: true };
};

export const listBackupsInS3 = async (target: S3Target, prefix: string) => {
  const client = createS3Client(target);
  const response = await client.send(
    new ListObjectsV2Command({
      Bucket: target.bucket,
      Prefix: prefix,
    }),
  );
  return response.Contents ?? [];
};
