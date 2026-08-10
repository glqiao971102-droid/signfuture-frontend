/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  // The PDF analyzers run in the Node runtime. Keep native/wasm-backed
  // packages external so they load from node_modules at runtime.
  serverExternalPackages: ["pdf-lib", "@hyzyla/pdfium", "pngjs", "tesseract.js"],
  // This machine is low on free RAM; keep static generation to a single,
  // memory-aware worker so the build doesn't OOM.
  experimental: {
    cpus: 1,
    memoryBasedWorkersCount: true,
    workerThreads: false,
  },
};

export default nextConfig;
