/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // The PDF analyzers run in the Node runtime. Keep native/wasm-backed
  // packages external so they load from node_modules at runtime.
  serverExternalPackages: ["pdf-lib", "@hyzyla/pdfium", "pngjs", "tesseract.js", "tesseract.js-core"],
  // The box-up analyzer OCRs records with tesseract.js. Ship the language data
  // inside the serverless function so it never has to download it at runtime
  // (Vercel's fs is read-only, so the CDN fallback + cache-write stalls it into
  // a 504). Keyed by the route's page path.
  outputFileTracingIncludes: {
    "/3d-box-up/app": ["./lib/tessdata/**"],
  },
  // This machine is low on free RAM; keep static generation to a single,
  // memory-aware worker so the build doesn't OOM.
  experimental: {
    cpus: 1,
    memoryBasedWorkersCount: true,
    workerThreads: false,
  },
};

export default nextConfig;
