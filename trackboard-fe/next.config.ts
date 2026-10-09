import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  /** Lets a phone on the same Wi-Fi open the dev server through the PC's LAN IP. */
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.20.10.*"],
};

export default config;
