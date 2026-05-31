/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
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
};

export default nextConfig;
