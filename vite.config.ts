import { defineConfig, Plugin, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import axios from "axios";
import {
  S3Client,
  ListObjectsV2Command,
  PutObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

function r2ServerPlugin(): Plugin {
  return {
    name: "r2-server-plugin",
    configureServer(server) {
      const getEnv = () => loadEnv(server.config.mode || "development", process.cwd(), "");

      const getS3Client = () => {
        const env = getEnv();
        const accountId = env.R2_ACCOUNT_ID || process.env.R2_ACCOUNT_ID;
        const accessKeyId = env.R2_ACCESS_KEY_ID || process.env.R2_ACCESS_KEY_ID;
        const secretAccessKey = env.R2_SECRET_ACCESS_KEY || process.env.R2_SECRET_ACCESS_KEY;

        if (!accountId || !accessKeyId || !secretAccessKey) {
          return null;
        }

        return new S3Client({
          region: "auto",
          endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
          credentials: { accessKeyId, secretAccessKey },
        });
      };

      const getBucketName = () => {
        const env = getEnv();
        return env.R2_BUCKET_NAME || process.env.R2_BUCKET_NAME;
      };

      function extractMonthFromFilename(filename: string): string {
        const match = filename.match(/T(\d{1,2})[_\s](\d{4})/i) || filename.match(/(\d{1,2})[_\/](\d{4})/);
        if (match) {
          return `Tháng ${match[1]}/${match[2]}`;
        }
        const now = new Date();
        return `Tháng ${now.getMonth() + 1}/${now.getFullYear()}`;
      }

      // 1. List files endpoint: GET /api/r2/files
      server.middlewares.use("/api/r2/files", async (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end();
          return;
        }

        const bucketName = getBucketName();
        const s3 = getS3Client();

        if (!s3 || !bucketName) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Thiếu cấu hình Cloudflare R2 Credentials trong file .env" }));
          return;
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

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(files));
        } catch (err: any) {
          console.error("R2 List Plugin Error:", err);
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message || "Failed to list R2 files" }));
        }
      });

      // 2. Download file buffer endpoint: GET /api/r2/file-buffer?key=...
      server.middlewares.use("/api/r2/file-buffer", async (req, res) => {
        if (req.method !== "GET") {
          res.statusCode = 405;
          res.end();
          return;
        }

        const bucketName = getBucketName();
        const s3 = getS3Client();

        if (!s3 || !bucketName) {
          res.statusCode = 500;
          res.end("Thiếu cấu hình R2 credentials");
          return;
        }

        try {
          const urlParams = new URL(req.url || "", `http://${req.headers.host}`).searchParams;
          const key = urlParams.get("key");
          if (!key) {
            res.statusCode = 400;
            res.end("Missing key parameter");
            return;
          }

          const getCmd = new GetObjectCommand({ Bucket: bucketName, Key: key });
          const getRes = await s3.send(getCmd);

          if (!getRes.Body) {
            res.statusCode = 404;
            res.end("File body not found");
            return;
          }

          const byteArray = await getRes.Body.transformToByteArray();
          res.setHeader("Content-Type", getRes.ContentType || "application/octet-stream");
          res.setHeader("Content-Length", byteArray.length);
          res.end(Buffer.from(byteArray));
        } catch (err: any) {
          console.error("R2 Buffer Plugin Error:", err);
          res.statusCode = 500;
          res.end("Failed to fetch file buffer");
        }
      });

      // 3. Upload file endpoint: POST /api/r2/upload
      server.middlewares.use("/api/r2/upload", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }

        const bucketName = getBucketName();
        const s3 = getS3Client();

        if (!s3 || !bucketName) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Thiếu cấu hình R2 Credentials" }));
          return;
        }

        try {
          const filenameHeader = req.headers["x-filename"];
          const filename = Array.isArray(filenameHeader) ? filenameHeader[0] : filenameHeader;
          if (!filename) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Missing x-filename header" }));
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

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify(fileObj));
        } catch (err: any) {
          console.error("R2 Upload Plugin Error:", err);
          let errorMsg = err.message || "Failed to upload to R2";
          if (err.name === "AccessDenied" || err.$metadata?.httpStatusCode === 403) {
            errorMsg = "R2 API Token hiện tại chỉ có quyền Đọc (Read-Only). Vui lòng tạo R2 API Token có quyền Edit / Admin (Object Read & Write) trên Cloudflare Dashboard và cập nhật vào file .env!";
          }
          res.statusCode = err.$metadata?.httpStatusCode || 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: errorMsg }));
        }
      });

      // 4. Delete file endpoint: DELETE /api/r2/delete?key=...
      server.middlewares.use("/api/r2/delete", async (req, res) => {
        if (req.method !== "DELETE") {
          res.statusCode = 405;
          res.end();
          return;
        }

        const bucketName = getBucketName();
        const s3 = getS3Client();

        if (!s3 || !bucketName) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: "Thiếu cấu hình R2 Credentials" }));
          return;
        }

        try {
          const urlParams = new URL(req.url || "", `http://${req.headers.host}`).searchParams;
          const key = urlParams.get("key");
          if (!key) {
            res.statusCode = 400;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({ error: "Missing key parameter" }));
            return;
          }

          const deleteCmd = new DeleteObjectCommand({ Bucket: bucketName, Key: key });
          await s3.send(deleteCmd);

          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ success: true }));
        } catch (err: any) {
          console.error("R2 Delete Plugin Error:", err);
          let errorMsg = err.message || "Failed to delete from R2";
          if (err.name === "AccessDenied" || err.$metadata?.httpStatusCode === 403) {
            errorMsg = "R2 API Token hiện tại chỉ có quyền Đọc (Read-Only). Vui lòng tạo R2 API Token có quyền Edit / Admin (Object Read & Write) trên Cloudflare Dashboard và cập nhật vào file .env!";
          }
          res.statusCode = err.$metadata?.httpStatusCode || 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: errorMsg }));
        }
      });
    },
  };
}

function lmsAuthServerPlugin(): Plugin {
  return {
    name: "lms-auth-server-plugin",
    configureServer(server) {
      server.middlewares.use("/api/lms-auth/token", async (req, res) => {
        if (req.method !== "GET" && req.method !== "POST") {
          res.statusCode = 405;
          res.end();
          return;
        }

        try {
          const env = loadEnv(server.config.mode || "development", process.cwd(), "");
          const username = env.LMS_TE_USERNAME || process.env.LMS_TE_USERNAME;
          const password = env.LMS_TE_PASSWORD || process.env.LMS_TE_PASSWORD;
          const firebaseApiKey = env.FIREBASE_API_KEY || process.env.FIREBASE_API_KEY;

          if (!username || !password || !firebaseApiKey) {
            throw new Error("Thiếu thông tin đăng nhập LMS (LMS_TE_USERNAME / LMS_TE_PASSWORD) trong file .env");
          }

          const query = `mutation loginWithUsername($username: String!, $password: String!) {
            users {
              loginWithUsername(
                loginWithUsernameInput: {username: $username, password: $password}
              ) { customToken }
            }
          }`;

          const loginRes = await axios.post(
            "https://base-api.mindx.edu.vn/graphql",
            {
              operationName: "loginWithUsername",
              variables: { username, password },
              query,
            },
            {
              headers: {
                "Content-Type": "application/json",
                origin: "https://base.mindx.edu.vn",
                referer: "https://base.mindx.edu.vn/",
              },
              timeout: 15000,
            }
          );

          if (loginRes.data?.errors) {
            throw new Error(loginRes.data.errors[0]?.message || "LMS Auth Error");
          }

          const customToken = loginRes.data?.data?.users?.loginWithUsername?.customToken;
          if (!customToken) {
            throw new Error("LMS API did not return customToken");
          }

          const firebaseRes = await axios.post(
            `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${firebaseApiKey}`,
            { token: customToken, returnSecureToken: true },
            { timeout: 15000 }
          );

          const token = firebaseRes.data?.idToken;
          if (!token) throw new Error("Firebase token error");

          res.setHeader("Content-Type", "application/json");
          res.end(
            JSON.stringify({
              token,
              expiresAt: Date.now() + 55 * 60 * 1000,
            })
          );
        } catch (err: any) {
          res.statusCode = 500;
          res.setHeader("Content-Type", "application/json");
          res.end(JSON.stringify({ error: err.message || "Authentication failed" }));
        }
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), r2ServerPlugin(), lmsAuthServerPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    port: 3001,
    host: true,
    proxy: {
      "/api/lms-gateway": {
        target: "https://lms-api.mindx.edu.vn",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/lms-gateway/, ""),
      },
      "/api/lms-base": {
        target: "https://base-api.mindx.edu.vn",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/lms-base/, ""),
      },
    },
  },
});
