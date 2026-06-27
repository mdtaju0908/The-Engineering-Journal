const { textModel } = require("../config/gemini");

function extractJson(text) {
  const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || [null, text];
  return JSON.parse(jsonMatch[1] || text);
}

function formatSources(sources = []) {
  if (!Array.isArray(sources) || !sources.length) {
    return "No live sources were available. Write a general evergreen article and do not invent citations.";
  }

  return sources
    .map((source, index) => {
      const date = source.publishedAt ? `Published: ${source.publishedAt}` : "Published: recent/unknown";
      const snippet = source.snippet ? `Summary: ${source.snippet}` : "";
      return `${index + 1}. ${source.title}\nSource: ${source.source}\nURL: ${source.url}\n${date}\n${snippet}`;
    })
    .join("\n\n");
}

async function generateBlogContent(topic, category, sources = []) {
  const prompt =
`You are an autonomous AI Blog Agent for a professional and diverse blog.

Topic: ${topic}
Category: ${category}
Current date: ${new Date().toISOString().slice(0, 10)}

Recent source material:
${formatSources(sources)}

1) Create an SEO title (max 60 chars) including the main keyword.
2) Write a comprehensive 800-1200 word article based on the recent source material.
3) Requirements:
   - Catchy Main Title
   - Meta description (150-160 chars)
   - Engaging Introduction
   - Write in both English and Hindi. Use English first, then a clearly labeled Hindi section.
   - Add a short "Quick Answer" section near the top that directly answers the main search intent in 2-4 sentences.
   - Add 4-6 "Key Takeaways" as concise bullet points.
   - Use H2 and H3 headings for structure
   - Include real-world examples, explanations, or code only if it genuinely fits the topic
   - If sources are provided, cite them naturally with markdown links in the article
   - Do not invent facts, numbers, quotes, launch dates, policies, or company claims
   - Mention why the topic matters right now
   - Keep important facts in normal visible text, not only in tables or images
   - Add an FAQ section with 3-5 natural search questions and short answers
   - Make the article helpful, reliable, people-first, and suitable for Google AI Overviews and Google Discover
   - Use a Discover-friendly headline: clear, accurate, not clickbait
   - Professional, human-like, and SEO-optimized tone
   - Conclusion
4) Include 5-8 relevant tags.
5) Add a "sourceLinks" array using only URLs from the provided source material.

Return ONLY valid JSON with these exact keys:
{
  "seoTitle": "string (<=60 chars)",
  "metaDescription": "string (150-160 chars)",
  "mainTitle": "string",
  "introduction": "string",
  "markdownBody": "string with markdown (##, ###, and code blocks)",
  "conclusion": "string",
  "tags": ["tag1","tag2","tag3","tag4","tag5"],
  "sourceLinks": ["https://source-one.example", "https://source-two.example"]
}`;

  const result = await textModel.generateContent(prompt);
  return extractJson(result.text);
}

module.exports = { generateBlogContent };

export {};
