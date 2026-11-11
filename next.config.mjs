/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // GEMINI_API_KEY is read server-side only (process.env.GEMINI_API_KEY),
  // never exposed to the client bundle. Do NOT prefix it with NEXT_PUBLIC_.
};

export default nextConfig;
