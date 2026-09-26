const withPWA = require("@ducanh2912/next-pwa").default({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.nba.com',
        pathname: '/headshots/**',
      },
      {
        protocol: 'https',
        hostname: 'ak-static.cms.nba.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'a.espncdn.com',
        pathname: '/**',
      },
    ],
  },
};

module.exports = withPWA(nextConfig);
