import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end();
    return;
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey || !bucketName) {
    res.status(500).json({ error: "Thiếu cấu hình R2 credentials" });
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
    const filenameHeader = req.headers["x-filename"];
    const filename = Array.isArray(filenameHeader) ? filenameHeader[0] : filenameHeader;
    if (!filename) {
      res.status(400).json({ error: "Missing x-filename header" });
      return;
    }

    const chunks: Uint8Array[] = [];
    for await (const chunk of req) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    const decodedFilename = decodeURIComponent(filename);

    const putCmd = new PutObjectCommand({
      Bucket: bucketName,
      Key: decodedFilename,
      Body: buffer,
      ContentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });

    await s3.send(putCmd);

    const fileObj = {
      id: decodedFilename,
      filename: decodedFilename,
      month: extractMonthFromFilename(decodedFilename),
      uploadedAt: new Date().toISOString(),
      size: `${(buffer.length / 1024).toFixed(1)} KB`,
      publicUrl: `/api/r2/file-buffer?key=${encodeURIComponent(decodedFilename)}`,
    };

    res.status(200).json(fileObj);
  } catch (err: any) {
    console.error("Vercel R2 Upload Error:", err);
    let errorMsg = err.message || "Failed to upload to R2";
    if (err.name === "AccessDenied" || err.$metadata?.httpStatusCode === 403) {
      errorMsg = "R2 API Token hiện tại chỉ có quyền Đọc (Read-Only). Vui lòng tạo R2 API Token có quyền Edit / Admin (Object Read & Write) trên Cloudflare Dashboard và cập nhật vào Vercel Environment Variables!";
    }
    res.status(err.$metadata?.httpStatusCode || 500).json({ error: errorMsg });
  }
}
