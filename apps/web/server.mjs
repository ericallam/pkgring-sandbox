import http from "node:http";

const port = Number(process.env.PORT ?? 3000);
const version = process.env.BUILD_APP_VERSION ?? "dev";
const sha = process.env.BUILD_GIT_SHA ?? "unknown";
const ref = process.env.BUILD_GIT_REF_NAME ?? "unknown";
const tsRaw = process.env.BUILD_TIMESTAMP_SECONDS ?? "0";
const builtAt = new Date(Number(tsRaw) * 1000).toISOString();

const payload = { version, sha, ref, builtAt };
const body = JSON.stringify(payload, null, 2);

const server = http.createServer((req, res) => {
  if (req.url === "/healthcheck") {
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(200, { "content-type": "application/json" });
  res.end(body);
});

server.listen(port, () => {
  console.log(`pkgring-web ${version} (${sha}) listening on :${port}`);
});

const shutdown = () => {
  server.close(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
