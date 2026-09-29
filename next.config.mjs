/** @type {import('next').NextConfig} */
const isCapacitorBuild = process.env.CAPACITOR_BUILD === '1';

const nextConfig = {
  reactStrictMode: true,
  ...(isCapacitorBuild ? {output: 'export', trailingSlash: true, images: {unoptimized: true}} : {})
};

export default nextConfig;
