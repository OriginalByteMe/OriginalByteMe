/** @type {import('next').NextConfig} */
const nextConfig = {
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
    ],
  },
};

export default nextConfig;
