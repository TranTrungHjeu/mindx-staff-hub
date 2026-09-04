import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end();
    return;
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    res.status(500).json({ error: "Thiếu cấu hình R2 Environment Variables trên Vercel" });
    return;
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  function extractMonthFromFilename(filename: string): string {
    const match = filename.match(/T(\d{1,2})[_\s](\d{4})/i) || filename.match(/(\d{1,2})[_\/](\d{4})/);
    if (match) {
      return `Tháng ${match[1]}/${match[2]}`;
    }
    const now = new Date();
    return `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
  }

  try {
    const listCmd = new ListObjectsV2Command({ Bucket: bucketName });
    const listRes = await s3.send(listCmd);

    const contents = listRes.Contents || [];
    const files = contents
      .filter((obj) => obj.Key && (obj.Key.endsWith(".xlsx") || obj.Key.endsWith(".xls")))
      .map((obj) => {
        const key = obj.Key!;
        return {
          id: key,
          filename: key,
          month: extractMonthFromFilename(key),
          uploadedAt: obj.LastModified ? obj.LastModified.toISOString() : new Date().toISOString(),
          size: `${((obj.Size || 0) / 1024).toFixed(1)} KB`,
          publicUrl: `/api/r2/file-buffer?key=${encodeURIComponent(key)}`,
        };
      })
      .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

    res.status(200).json(files);
  } catch (err: any) {
    console.error("Vercel R2 List Error:", err);
    res.status(500).json({ error: err.message || "Failed to list R2 files" });
  }
}
