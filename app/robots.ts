import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/dashboard", "/sign-in", "/setup"] },
    sitemap: "https://moonbag.ai/sitemap.xml",
  };
}
