import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pino-pretty", "lokijs", "encoding"],
  webpack: (config) => {
    // Ignore test files and other non-code files from thread-stream
    const webpack = require("webpack");
    config.plugins = config.plugins || [];
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /thread-stream\/test/,
      }),
      new webpack.IgnorePlugin({
        resourceRegExp: /thread-stream\/.*\.(test|spec)\.(js|mjs|ts)$/,
      }),
      new webpack.IgnorePlugin({
        resourceRegExp: /thread-stream\/.*\.(md|txt|zip|sh|yml)$/,
      }),
      new webpack.IgnorePlugin({
        resourceRegExp: /thread-stream\/bench\.js$/,
      }),
      new webpack.IgnorePlugin({
        resourceRegExp: /thread-stream\/LICENSE$/,
      }),
      // Ignore React Native dependencies that MetaMask SDK tries to import
      new webpack.IgnorePlugin({
        resourceRegExp: /@react-native-async-storage\/async-storage/,
      })
    );

    // Add fallback for React Native modules
    config.resolve = config.resolve || {};
    config.resolve.fallback = {
      ...config.resolve.fallback,
      "@react-native-async-storage/async-storage": false,
    };

    return config;
  },
};

export default nextConfig;
