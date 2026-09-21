/** @type {import('next').NextConfig} */
module.exports = {
  reactStrictMode: true,
  transpilePackages: ['@ford/ui', '@ford/types'],
  env: {
    NEXT_PUBLIC_API_URL: process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3333',
  },
};
