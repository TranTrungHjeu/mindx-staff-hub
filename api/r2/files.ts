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
    if (!filename) {
      const now = new Date();
      return `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
    }
    const thangMatch = filename.match(/Th[áa]ng[_\s-]*0*(\d{1,2})[_\s\/\.-]*(\d{4})/i);
    if (thangMatch) return `Tháng ${Number(thangMatch[1])}/${thangMatch[2]}`;

    const tYearMatch = filename.match(/T[_\s-]*0*(\d{1,2})[_\s\/\.-]+(\d{4})/i);
    if (tYearMatch) return `Tháng ${Number(tYearMatch[1])}/${tYearMatch[2]}`;

    const monthYearMatch = filename.match(/(?:^|[_\s\.-])0*(\d{1,2})[_\/\.-](\d{4})(?:[_\s\.-]|$)/);
    if (monthYearMatch) {
      const m = Number(monthYearMatch[1]);
      const y = Number(monthYearMatch[2]);
      if (m >= 1 && m <= 12) return `Tháng ${m}/${y}`;
    }

    const yearMonthMatch = filename.match(/(?:^|[_\s\.-])(\d{4})[_\/\.-]0*(\d{1,2})(?:[_\s\.-]|$)/);
    if (yearMonthMatch) {
      const y = Number(yearMonthMatch[1]);
      const m = Number(yearMonthMatch[2]);
      if (m >= 1 && m <= 12) return `Tháng ${m}/${y}`;
    }

    const tOnlyMatch = filename.match(/T[_\s-]*0*(\d{1,2})(?:[_\s\.-]|$)/i) || filename.match(/Th[áa]ng[_\s-]*0*(\d{1,2})/i);
    if (tOnlyMatch) {
      const m = Number(tOnlyMatch[1]);
      if (m >= 1 && m <= 12) {
        const now = new Date();
        return `Tháng ${m}/${now.getFullYear()}`;
      }
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
