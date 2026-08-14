import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

function localApiPlugin() {
  return {
    name: "local-api",
    configureServer(server: any) {
      server.middlewares.use(
        "/api/voice",
        async (req: any, res: any, next: any) => {
          if (req.method !== "POST") {
            next();
            return;
          }

          try {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(Buffer.from(chunk));
            req.body = JSON.parse(
              Buffer.concat(chunks).toString("utf8") || "{}",
            );

            const { default: handler } = await import("./api/voice.js");
            res.status = (code: number) => {
              res.statusCode = code;
              return res;
            };
            res.json = (body: unknown) => {
              res.setHeader("Content-Type", "application/json");
              res.end(JSON.stringify(body));
            };
            await handler(req, res);
          } catch (error) {
            next(error);
          }
        },
      );
    },
  };
}

// Load local env files into process.env so server middleware sees them
dotenv.config();
dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), viteSingleFile(), localApiPlugin()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
