const axios = require("axios");
const { XMLParser } = require("fast-xml-parser");
const googleTrends = require("google-trends-api");

const DEFAULT_QUERIES = [
  "latest India technology news",
  "latest artificial intelligence news",
  "latest startup business news India",
  "latest career jobs education news India",
  "latest social media digital trends"
];

const NEWS_CATEGORIES = [
  "Technology",
  "Artificial Intelligence",
  "Programming",
  "Web Development",
  "Indian News",
  "College Life",
  "Student Life",
  "Career & Jobs",
  "Startup & Business",
  "Social Media Trends",
  "Business",
  "World News"
];

function clampNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, min), max);
}

function getRecentNewsDays() {
  return clampNumber(process.env.RECENT_NEWS_DAYS, 2, 1, 7);
}

function getMaxResults() {
  return clampNumber(process.env.NEWS_SEARCH_MAX_RESULTS, 6, 3, 10);
}

function getQueries() {
  const configured = (process.env.NEWS_SEARCH_QUERIES || "")
    .split(",")
    .map((query) => query.trim())
    .filter(Boolean);

  return configured.length ? configured : DEFAULT_QUERIES;
}

function parsePublishedDate(value) {
  if (!value) return null;
  if (typeof value === "number") return new Date(value * 1000);

  const text = String(value).trim();
  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) return direct;

  const relative = text.match(/(\d+)\s*(minute|hour|day|week|month|year)s?\s*ago/i);
  if (relative) {
    const amount = Number(relative[1]);
    const unit = relative[2].toLowerCase();
    const multipliers = {
      minute: 60 * 1000,
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000
    };
    return new Date(Date.now() - amount * multipliers[unit]);
  }

  if (/yesterday/i.test(text)) {
    return new Date(Date.now() - 24 * 60 * 60 * 1000);
  }

  return null;
}

function isFresh(publishedAt, days) {
  if (!publishedAt) return true;
  const date = publishedAt instanceof Date ? publishedAt : parsePublishedDate(publishedAt);
  if (!date || Number.isNaN(date.getTime())) return true;
  const oldestAllowed = Date.now() - days * 24 * 60 * 60 * 1000;
  return date.getTime() >= oldestAllowed;
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function stripHtml(value = "") {
  return String(value).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeResult(result) {
  const publishedAt = parsePublishedDate(result.publishedAt || result.publishedDate || result.date);
  const url = result.url || result.link || "";
  const title = (result.title || "").trim();

  if (!title || !url) return null;

  return {
    title,
    url,
    source: result.source || hostname(url) || result.provider || "Web",
    snippet: (result.snippet || result.content || result.summary || "").trim(),
    publishedAt: publishedAt ? publishedAt.toISOString() : "",
    provider: result.provider || "web"
  };
}

function uniqueResults(results, days) {
  const seen = new Set();

  return results
    .map(normalizeResult)
    .filter(Boolean)
    .filter((item) => isFresh(item.publishedAt, days))
    .filter((item) => {
      const key = item.url || item.title.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

async function searchTavily(query, days, maxResults) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return [];

  const response = await axios.post(
    "https://api.tavily.com/search",
    {
      query,
      topic: "news",
      search_depth: "advanced",
      max_results: maxResults,
      days,
      time_range: days <= 1 ? "day" : "week",
      include_answer: false,
      include_raw_content: false,
      include_images: false
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      timeout: 20000
    }
  );

  return Array.isArray(response.data?.results)
    ? response.data.results.map((item) => ({
        title: item.title,
        url: item.url,
        snippet: item.content,
        publishedAt: item.published_date,
        source: hostname(item.url),
        provider: "tavily"
      }))
    : [];
}

async function searchSerpApi(query, days, maxResults) {
  const apiKey = process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY;
  if (!apiKey) return [];

  const response = await axios.get("https://serpapi.com/search", {
    params: {
      engine: "google_news",
      q: `${query} when:${days}d`,
      gl: process.env.NEWS_SEARCH_COUNTRY || "in",
      hl: process.env.NEWS_SEARCH_LANGUAGE || "en",
      num: maxResults,
      api_key: apiKey
    },
    timeout: 20000
  });

  if (!Array.isArray(response.data?.news_results)) return [];

  const flatResults = response.data.news_results.flatMap((item) => {
    const stories = Array.isArray(item.stories) ? item.stories : [];
    return [item, ...stories];
  });

  return flatResults
    .slice(0, maxResults)
    .map((item) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        publishedAt: item.date,
        source: item.source?.name || item.source || hostname(item.link),
        provider: "serpapi"
      }));
}

async function searchGoogleNewsRss(query, days, maxResults) {
  const country = (process.env.NEWS_SEARCH_COUNTRY || "in").toUpperCase();
  const language = process.env.NEWS_SEARCH_LANGUAGE || "en";
  const parser = new XMLParser({ ignoreAttributes: false });
  const url = "https://news.google.com/rss/search";

  const response = await axios.get(url, {
    params: {
      q: `${query} when:${days}d`,
      hl: `${language}-${country}`,
      gl: country,
      ceid: `${country}:${language}`
    },
    timeout: 15000
  });
  const parsed = parser.parse(response.data);
  const items = parsed?.rss?.channel?.item
    ? Array.isArray(parsed.rss.channel.item)
      ? parsed.rss.channel.item
      : [parsed.rss.channel.item]
    : [];

  return items.slice(0, maxResults).map((item) => ({
    title: item.title,
    url: item.link,
    snippet: stripHtml(item.description),
    publishedAt: item.pubDate,
    source: item.source?.["#text"] || item.source || hostname(item.link),
    provider: "google-news-rss"
  }));
}

async function fetchFallbackTrends(maxResults) {
  const results = [];

  try {
    const hn = await axios.get("https://hacker-news.firebaseio.com/v0/topstories.json", { timeout: 10000 });
    const topIds = Array.isArray(hn.data) ? hn.data.slice(0, maxResults) : [];
    const stories = await Promise.all(
      topIds.map((id) =>
        axios.get(`https://hacker-news.firebaseio.com/v0/item/${id}.json`, { timeout: 10000 }).catch(() => ({ data: {} }))
      )
    );

    stories.forEach((story) => {
      if (story.data?.title && story.data?.url) {
        results.push({
          title: story.data.title,
          url: story.data.url,
          snippet: story.data.title,
          publishedAt: story.data.time,
          source: hostname(story.data.url) || "Hacker News",
          provider: "hacker-news"
        });
      }
    });
  } catch (error) {
    console.error("Hacker News fallback failed:", error.message);
  }

  try {
    const devto = await axios.get("https://dev.to/api/articles?top=5", { timeout: 10000 });
    if (Array.isArray(devto.data)) {
      devto.data.slice(0, maxResults).forEach((article) => {
        results.push({
          title: article.title,
          url: article.url,
          snippet: article.description,
          publishedAt: article.published_at,
          source: "dev.to",
          provider: "dev.to"
        });
      });
    }
  } catch (error) {
    console.error("Dev.to fallback failed:", error.message);
  }

  try {
    const dailyIN = await googleTrends.dailyTrends({ geo: "IN" }).catch(() => null);
    if (dailyIN) {
      const parsed = JSON.parse(dailyIN);
      const days = parsed?.default?.trendingSearchesDays || [];
      days
        .flatMap((day) => day?.trendingSearches || [])
        .slice(0, maxResults)
        .forEach((trend) => {
          const title = trend?.title?.query;
          if (title) {
            results.push({
              title,
              url: `https://trends.google.com/trends/explore?q=${encodeURIComponent(title)}&geo=IN`,
              snippet: `Google Trends India topic: ${title}`,
              publishedAt: new Date().toISOString(),
              source: "Google Trends India",
              provider: "google-trends"
            });
          }
        });
    }
  } catch (error) {
    console.error("Google Trends fallback failed:", error.message);
  }

  return results;
}

async function getRecentNewsSources() {
  const days = getRecentNewsDays();
  const maxResults = getMaxResults();
  const queries = getQueries();
  const providerTasks = queries.flatMap((query) => [
    searchTavily(query, days, maxResults).catch((error) => {
      console.error(`Tavily search failed for "${query}":`, error.message);
      return [];
    }),
    searchSerpApi(query, days, maxResults).catch((error) => {
      console.error(`SerpAPI search failed for "${query}":`, error.message);
      return [];
    }),
    searchGoogleNewsRss(query, days, maxResults).catch((error) => {
      console.error(`Google News RSS search failed for "${query}":`, error.message);
      return [];
    })
  ]);

  const providerResults = (await Promise.all(providerTasks)).flat();
  let sources = uniqueResults(providerResults, days);
  const usedFallback = sources.length < 5;

  if (usedFallback) {
    const fallbackResults = await fetchFallbackTrends(maxResults);
    sources = uniqueResults([...sources, ...fallbackResults], days);
  }

  return {
    sources: sources.slice(0, 30),
    queries,
    days,
    categories: NEWS_CATEGORIES,
    usedFallback,
    providers: {
      tavily: Boolean(process.env.TAVILY_API_KEY),
      serpapi: Boolean(process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY),
      googleNewsRss: true
    }
  };
}

module.exports = {
  getRecentNewsSources,
  NEWS_CATEGORIES
};

export {};
