import type { NewsItem } from "../types/news";

export async function getNewsItems(): Promise<NewsItem[]> {
  const newsUrl = new URL(
    `${import.meta.env.BASE_URL}data/news.json`,
    window.location.href,
  );
  newsUrl.searchParams.set("updated", Date.now().toString());

  const response = await fetch(newsUrl, { cache: "no-store" });

  if (!response.ok) {
    throw new Error(`Could not load news (${response.status})`);
  }

  const news: unknown = await response.json();

  if (!Array.isArray(news)) {
    throw new Error("News data must be an array");
  }

  return news as NewsItem[];
}
