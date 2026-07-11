import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: '/index.html', destination: '/', permanent: true },
      { source: '/movies/index.html', destination: '/movies', permanent: true },
      { source: '/books/index.html', destination: '/books', permanent: true },
      { source: '/travel/index.html', destination: '/travel', permanent: true },
    ]
  },
};

export default nextConfig;
