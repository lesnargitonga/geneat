/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  webpack(config) {
    config.resolve.alias = {
      ...(config.resolve.alias || {}),
      "@": process.cwd(),
    };
    return config;
  },
  images: {
    formats: ["image/avif", "image/webp"],
    deviceSizes: [384, 640, 750, 828, 1080, 1200, 1920],
    imageSizes: [128, 180, 256, 300, 384],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "source.unsplash.com" },
    ],
  },
  async rewrites() {
    return [
      // Proxy chat + reservation calls to the backend in dev
      { source: "/api/backend/:path*", destination: "http://localhost:8000/:path*" },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.hazina.lesnarai.co.ke" }],
        destination: "https://hazina.lesnarai.co.ke/:path*",
        permanent: true,
      },
      { source: "/treasures", destination: "/build", permanent: true },
      {
        source: "/last-minute-kenya-gifts-jkia",
        destination: "/collections/departure-drop",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
