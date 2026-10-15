/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      { source: "/app/master-data", tab: "retailers", destination: "/app/retailers?tab=directory" },
      { source: "/app/operations", tab: "coverage", destination: "/app/retailers?tab=coverage" },
      { source: "/app/finance", tab: "outstanding", destination: "/app/retailers?tab=outstanding" },
      { source: "/app/finance", tab: "collection", destination: "/app/retailers?tab=collections" }
    ].map(({ source, tab, destination }) => ({
      source,
      has: [{ type: "query", key: "tab", value: tab }],
      destination,
      permanent: false
    }));
  }
};

export default nextConfig;
