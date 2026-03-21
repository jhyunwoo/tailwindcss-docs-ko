import type { NextConfig } from "next";
import createMdx from "@next/mdx";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@tailwindcss/node"],
  pageExtensions: ["js", "jsx", "ts", "tsx", "mdx"],
  outputFileTracingIncludes: {
    "/**/*": ["./src/content/source/**/*.mdx", "./src/content/docs/**/*.mdx"],
  },
  async redirects() {
    return [
      {
        source: "/docs",
        destination: "/docs/installation/using-vite",
        permanent: false,
      },
      {
        source: "/docs/installation",
        destination: "/docs/installation/using-vite",
        permanent: false,
      },
      {
        source: "/docs/installation/framework-guides/laravel",
        destination: "/docs/installation/framework-guides/laravel/vite",
        permanent: false,
      },
      {
        source: "/docs/installation/framework-guides/rspack",
        destination: "/docs/installation/framework-guides/rspack/react",
        permanent: false,
      },
      {
        source: "/docs/text-color",
        destination: "/docs/color",
        permanent: false,
      },
    ];
  },
};

const withMdx = createMdx();

export default withMdx(nextConfig);
