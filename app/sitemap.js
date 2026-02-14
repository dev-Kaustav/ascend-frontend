const siteUrl = "https://ascendfoods.in";

const routes = [
  { path: "", changeFrequency: "daily", priority: 1 }
];

export default function sitemap() {
  const lastModified = new Date();

  return routes.map((route) => ({
    url: `${siteUrl}${route.path}`,
    lastModified,
    changeFrequency: route.changeFrequency,
    priority: route.priority
  }));
}
