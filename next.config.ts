import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "mls-producers-lifetime-editor.trycloudflare.com",
    "*.trycloudflare.com",
    "*.lhr.life",
    "*.loca.lt",
    "*.ngrok-free.app",
    "172.16.130.112",
    "172.16.130.112:3000",
    "10.124.212.143",
    "localhost:3000",
  ],
};

export default nextConfig;
