import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@huggingface/transformers", "onnxruntime-node", "@imgly/background-removal", "onnxruntime-web", "sharp"],
  outputFileTracingExcludes: {
    "*": [
      "node_modules/@imgly/background-removal/**/*",
      "node_modules/onnxruntime-web/**/*",
      "node_modules/onnxruntime-node/**/*",
    ],
    "/api/closet/detect": [
      "node_modules/onnxruntime-node/**/*",
      "node_modules/@huggingface/transformers/**/*",
      "node_modules/onnxruntime-web/**/*",
    ],
    "/api/bot/outfits/request": [
      "node_modules/onnxruntime-node/**/*",
      "node_modules/@huggingface/transformers/**/*",
      "node_modules/onnxruntime-web/**/*",
    ],
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "sharp$": false,
        "onnxruntime-node$": false,
      };
    }
    return config;
  },
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
      {
        source: "/manifest.webmanifest",
        headers: [{ key: "Content-Type", value: "application/manifest+json" }],
      },
    ];
  },
};

export default nextConfig;
