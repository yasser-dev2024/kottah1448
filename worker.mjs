const ASSETS = __SITE_ASSETS__;

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let path = decodeURIComponent(url.pathname).replace(/^\/+/, "");
    if (!path) path = "index.html";

    let asset = ASSETS[path];
    if (!asset && request.headers.get("accept")?.includes("text/html")) {
      asset = ASSETS["index.html"];
      path = "index.html";
    }
    if (!asset) return new Response("Not found", { status: 404 });

    const headers = new Headers({
      "Content-Type": asset.type,
      "X-Content-Type-Options": "nosniff",
    });
    headers.set(
      "Cache-Control",
      path === "index.html" || path.endsWith(".json") || path.endsWith(".js")
        ? "no-cache"
        : "public, max-age=86400",
    );

    return new Response(request.method === "HEAD" ? null : decodeBase64(asset.body), {
      status: 200,
      headers,
    });
  },
};
