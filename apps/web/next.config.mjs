/** @type {import('next').NextConfig} */
const apiBase = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

function imagePatternFor(baseUrl) {
  try {
    const url = new URL(baseUrl);
    return {
      protocol: url.protocol.replace(':', ''),
      hostname: url.hostname,
      port: url.port || '',
      pathname: '/**',
    };
  } catch {
    return null;
  }
}

const remotePatterns = [
  imagePatternFor(apiBase),
  {
    protocol: 'http',
    hostname: 'localhost',
    port: '8000',
    pathname: '/**',
  },
  {
    protocol: 'http',
    hostname: '127.0.0.1',
    port: '8000',
    pathname: '/**',
  },
].filter(Boolean);

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@versuitality/ui', '@versuitality/types'],
  experimental: {
    typedRoutes: true,
  },
  images: {
    remotePatterns,
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiBase}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
