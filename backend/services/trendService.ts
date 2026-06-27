const { textModel } = require("../config/gemini");
const { getRecentNewsSources, NEWS_CATEGORIES } = require("./newsSearchService");

function extractJson(text) {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || [null, text];
  return JSON.parse(jsonMatch[1] || text);
}

function formatSourcesForPrompt(sources) {
  return sources
    .map((source, index) => {
      const date = source.publishedAt ? `Published: ${source.publishedAt}` : "Published: recent/unknown";
      const snippet = source.snippet ? `Summary: ${source.snippet}` : "";
      return `${index + 1}. ${source.title}\nSource: ${source.source}\nURL: ${source.url}\n${date}\n${snippet}`;
    })
    .join("\n\n");
}

async function getTrendingTopic() {
  try {
    const searchContext = await getRecentNewsSources();
    const sources = searchContext.sources || [];

    if (!sources.length) {
      return {
        topic: "Latest Technology and AI Trends You Should Know Today",
        category: "Technology",
        sources: [],
        searchContext
      };
    }

    const prompt =
      `You are selecting a fresh blog topic for a portfolio blog.\n\n` +
      `Current date: ${new Date().toISOString().slice(0, 10)}\n` +
      `Recency rule: choose a topic based only on sources from the last ${searchContext.days} day(s).\n` +
      `Allowed categories: ${NEWS_CATEGORIES.join(", ")}.\n\n` +
      `Recent web/news sources:\n${formatSourcesForPrompt(sources)}\n\n` +
      `Task:\n` +
      `1. Pick ONE topic that is timely, useful, and engaging for a general tech/news blog audience.\n` +
      `2. It can be news, article, business, career, AI, technology, social media, startup, or student-focused.\n` +
      `3. Prefer topics supported by at least 2 source URLs.\n` +
      `4. Create a strong SEO-friendly blog title in 8-14 words.\n\n` +
      `Return ONLY valid JSON in this format:\n` +
      `{\n` +
      `  "title": "The Final Blog Title",\n` +
      `  "category": "Selected Category",\n` +
      `  "sourceUrls": ["https://source-one.example", "https://source-two.example"],\n` +
      `  "reason": "short reason"\n` +
      `}`;

    const result = await textModel.generateContent(prompt);
    const data = extractJson(result.text);
    const selectedUrls = Array.isArray(data.sourceUrls) ? data.sourceUrls : [];
    const selectedSources = sources.filter((source) => selectedUrls.includes(source.url));

    return {
      topic: data.title || sources[0].title,
      category: data.category || "Technology",
      sources: selectedSources.length ? selectedSources : sources.slice(0, 5),
      searchContext
    };
  } catch (err) {
    console.error("Trend Service Error:", err);
    return {
      topic: "How AI is Transforming Modern Web Development in 2026",
      category: "Technology",
      sources: [],
      searchContext: null
    };
  }
}

module.exports = { getTrendingTopic };

export {};
