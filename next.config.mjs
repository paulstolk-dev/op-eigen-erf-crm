/** @type {import('next').NextConfig} */
const nextConfig = {
  // react-pdf is een zware Node-only lib; niet meebundelen.
  serverExternalPackages: ["@react-pdf/renderer"],
  experimental: {
    // Logo-/fotouploads (aanbieders/woningen) gaan via een Server Action.
    // Standaardlimiet is 1 MB; verhoogd naar 10 MB zodat de eigen 8 MB-check
    // in uploadAanbiedersFile leidend is (incl. FormData-overhead).
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
