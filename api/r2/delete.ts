import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

export default async function handler(req: any, res: any) {
  if (req.method !== "DELETE") {
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

  try {
    const key = req.query.key || new URL(req.url || "", `http://${req.headers.host}`).searchParams.get("key");
    if (!key) {
      res.status(400).json({ error: "Missing key parameter" });
      return;
    }

    const deleteCmd = new DeleteObjectCommand({ Bucket: bucketName, Key: key });
    await s3.send(deleteCmd);

    res.status(200).json({ success: true });
  } catch (err: any) {
    console.error("Vercel R2 Delete Error:", err);
    let errorMsg = err.message || "Failed to delete from R2";
    if (err.name === "AccessDenied" || err.$metadata?.httpStatusCode === 403) {
      errorMsg = "R2 API Token hiện tại chỉ có quyền Đọc (Read-Only). Vui lòng tạo R2 API Token có quyền Edit / Admin (Object Read & Write) trên Cloudflare Dashboard và cập nhật vào Vercel Environment Variables!";
    }
    res.status(err.$metadata?.httpStatusCode || 500).json({ error: errorMsg });
  }
}
