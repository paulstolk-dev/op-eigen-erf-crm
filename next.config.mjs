/** @type {import('next').NextConfig} */
const nextConfig = {
  // react-pdf is een zware Node-only lib; niet meebundelen.
  serverExternalPackages: ["@react-pdf/renderer"],
};

export default nextConfig;
