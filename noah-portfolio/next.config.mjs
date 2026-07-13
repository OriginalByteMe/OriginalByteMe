/** @type {import('next').NextConfig} */
const nextConfig = {
  // The corpus is read from disk at runtime (lib/corpus/loader.ts) by the
  // root layout. Output file tracing doesn't pick the markdown up for the
  // page functions (only the API routes trace it), so on Vercel the home
  // page rendered with an EMPTY corpus — every statePath-bound section
  // (skills, career, projects, contact) came out blank. Force-include it.
  outputFileTracingIncludes: {
    "/**": ["./content/about-me/**/*"],
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
        pathname: "/wikipedia/commons/**",
      },
      {
        protocol: "https",
        hostname: "cdn.jsdelivr.net",
        pathname: "/gh/devicons/**",
      },
      {
        protocol: "https",
        hostname: "cdn.prod.website-files.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "bowiq.com",
        pathname: "/wp-content/themes/bowiq/img/**",
      },
      {
        protocol: "https",
        hostname: "registry.npmmirror.com",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "i.scdn.co",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
