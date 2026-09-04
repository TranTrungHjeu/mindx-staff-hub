import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";

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
    res.status(500).end("Thiếu cấu hình R2 credentials");
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
      res.status(400).end("Missing key parameter");
      return;
    }

    const getCmd = new GetObjectCommand({ Bucket: bucketName, Key: key });
    const getRes = await s3.send(getCmd);

    if (!getRes.Body) {
      res.status(404).end("File body not found");
      return;
    }

    const byteArray = await getRes.Body.transformToByteArray();
    res.setHeader("Content-Type", getRes.ContentType || "application/octet-stream");
    res.setHeader("Content-Length", byteArray.length);
    res.status(200).send(Buffer.from(byteArray));
  } catch (err: any) {
    console.error("Vercel R2 Buffer Error:", err);
    res.status(500).end("Failed to fetch file buffer");
  }
}
