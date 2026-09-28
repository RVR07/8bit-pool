/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/index.html',
        headers: [{ key: 'Cache-Control', value: 'no-store' }]
      }
    ];
  }
};

export default nextConfig;
