/** @type {import("next").NextConfig} */
const nextConfig = {
  webpack(config, { webpack }) {
    config.plugins.push(
      new webpack.IgnorePlugin({
        resourceRegExp: /^(@react-native-async-storage\/async-storage|pino-pretty)$/
      })
    );

    return config;
  }
};

export default nextConfig;
