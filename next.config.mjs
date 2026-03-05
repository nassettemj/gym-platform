/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    // Skip ESLint during production builds (we still run it locally)
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;

