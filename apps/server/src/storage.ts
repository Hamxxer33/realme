import {
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/** Media is encrypted on the phone before upload; storage only ever holds opaque bytes. */
export interface Storage {
  presignUpload(key: string, size: number): Promise<string>;
  presignDownload(key: string): Promise<string>;
  deletePrefix(prefix: string): Promise<void>;
}

const URL_TTL_SECONDS = 15 * 60;

export function s3Storage(opts: {
  endpoint?: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
}): Storage {
  const client = new S3Client({
    endpoint: opts.endpoint,
    region: opts.region,
    credentials: { accessKeyId: opts.accessKeyId, secretAccessKey: opts.secretAccessKey },
  });
  const Bucket = opts.bucket;

  return {
    presignUpload: (Key, size) =>
      getSignedUrl(
        client,
        new PutObjectCommand({ Bucket, Key, ContentLength: size, ContentType: 'application/octet-stream' }),
        { expiresIn: URL_TTL_SECONDS },
      ),
    presignDownload: (Key) => getSignedUrl(client, new GetObjectCommand({ Bucket, Key }), { expiresIn: URL_TTL_SECONDS }),
    async deletePrefix(Prefix) {
      let ContinuationToken: string | undefined;
      do {
        const page = await client.send(new ListObjectsV2Command({ Bucket, Prefix, ContinuationToken }));
        const Objects = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
        if (Objects.length) await client.send(new DeleteObjectsCommand({ Bucket, Delete: { Objects } }));
        ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (ContinuationToken);
    },
  };
}
