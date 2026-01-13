const siteUrl = "https://ascendfoods.in";

const routes = [
  { path: "", changeFrequency: "monthly", priority: 1 },
  { path: "/product", changeFrequency: "monthly", priority: 0.9 },
  { path: "/how-it-works", changeFrequency: "monthly", priority: 0.85 },
  { path: "/why-ascend", changeFrequency: "monthly", priority: 0.85 },
  { path: "/who-its-for", changeFrequency: "monthly", priority: 0.8 },
  { path: "/contact", changeFrequency: "monthly", priority: 0.7 }
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
