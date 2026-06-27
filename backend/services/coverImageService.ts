const { cloudinary } = require("../config/cloudinary");
const axios = require("axios");
const stream = require("stream");
const slugify = require("slugify");
const sharp = require("sharp");
const { genAI } = require("../config/gemini");

function getCoverQuery(title, category) {
  return `${title} ${category} real photo news article cover`;
}

function getPublicId(title, source) {
  const base = slugify(title, { lower: true, strict: true }).slice(0, 55) || "blog-cover";
  return `${base}-${source}`;
}

function unique(items) {
  return [...new Set(items.filter(Boolean))];
}

function pickTavilyImageUrls(data) {
  const topLevel = Array.isArray(data?.images)
    ? data.images.map((image) => (typeof image === "string" ? image : image?.url))
    : [];
  const resultImages = Array.isArray(data?.results)
    ? data.results.flatMap((result) => {
        if (!Array.isArray(result.images)) return [];
        return result.images.map((image) => (typeof image === "string" ? image : image?.url));
      })
    : [];

  return unique([...topLevel, ...resultImages]);
}

function pickSerpImageUrls(data) {
  if (!Array.isArray(data?.images_results)) return [];
  return unique(
    data.images_results.flatMap((item) => [
      item.original,
      item.thumbnail,
      item.link
    ])
  );
}

async function ensureSupportedFormat(buffer, mime) {
  const type = (mime || "").toLowerCase();
  const image = sharp(buffer, { failOn: "none" }).rotate();
  const metadata = await image.metadata();

  if (!metadata.width || !metadata.height || metadata.width < 500 || metadata.height < 300) {
    throw new Error("Image too small for blog cover");
  }

  if (type.includes("jpeg") || type.includes("jpg")) {
    const jpgBuf = await image.resize(1200, 630, { fit: "cover", position: "attention" }).jpeg({ quality: 88 }).toBuffer();
    return { buffer: jpgBuf, format: "jpg" };
  }

  const pngBuf = await image.resize(1200, 630, { fit: "cover", position: "attention" }).png().toBuffer();
  return { buffer: pngBuf, format: "png" };
}

async function uploadBufferToCloudinary(buffer, publicId, format = "jpg") {
  return new Promise((resolve, reject) => {
    const pass = new stream.PassThrough();
    pass.end(buffer);
    cloudinary.uploader.upload_stream(
      { public_id: publicId, folder: "ai-blog-covers", overwrite: true, resource_type: "image", format },
      (error, result) => {
        if (error) reject(error);
        else resolve(result.secure_url);
      }
    ).end(buffer);
  });
}

async function downloadAndUploadImage(imageUrl, title, source, headers = {}) {
  const res = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    timeout: 18000,
    maxContentLength: 15 * 1024 * 1024,
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MdTajuBlogBot/1.0)",
      ...headers
    }
  });

  const mime = res.headers["content-type"] || "";
  if (!mime.toLowerCase().startsWith("image/")) {
    throw new Error(`URL did not return an image: ${mime}`);
  }

  const { buffer, format } = await ensureSupportedFormat(Buffer.from(res.data), mime);
  const uploaded = await uploadBufferToCloudinary(buffer, getPublicId(title, source), format);
  return { url: uploaded, source };
}

async function uploadFirstWorkingImage(urls, title, source) {
  for (const url of urls) {
    try {
      return await downloadAndUploadImage(url, title, source);
    } catch (error) {
      console.log(`${source} image skipped: ${error.message}`);
    }
  }
  return null;
}

async function tryTavilyImages(title, category) {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) return null;

  const res = await axios.post(
    "https://api.tavily.com/search",
    {
      query: getCoverQuery(title, category),
      topic: "general",
      search_depth: "basic",
      max_results: 5,
      include_answer: false,
      include_raw_content: false,
      include_images: true,
      include_image_descriptions: true,
      country: "india"
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      timeout: 20000
    }
  );

  return uploadFirstWorkingImage(pickTavilyImageUrls(res.data), title, "tavily");
}

async function trySerpApiImages(title, category) {
  const apiKey = process.env.SERPAPI_API_KEY || process.env.SERP_API_KEY;
  if (!apiKey) return null;

  const res = await axios.get("https://serpapi.com/search", {
    params: {
      engine: "google_images",
      q: getCoverQuery(title, category),
      gl: process.env.NEWS_SEARCH_COUNTRY || "in",
      hl: process.env.NEWS_SEARCH_LANGUAGE || "en",
      imgsz: "l",
      image_type: "photo",
      safe: "active",
      api_key: apiKey
    },
    timeout: 20000
  });

  return uploadFirstWorkingImage(pickSerpImageUrls(res.data), title, "serpapi");
}

async function tryPexels(title, category) {
  const pexelsKey = process.env.PEXELS_API_KEY;
  if (!pexelsKey) return null;

  const res = await axios.get("https://api.pexels.com/v1/search", {
    params: {
      query: getCoverQuery(title, category),
      per_page: 5,
      orientation: "landscape",
      size: "large",
      locale: "en-US"
    },
    headers: { Authorization: pexelsKey },
    timeout: 15000
  });

  const urls = Array.isArray(res.data?.photos)
    ? res.data.photos.map((photo) => photo.src?.large2x || photo.src?.landscape || photo.src?.original)
    : [];

  return uploadFirstWorkingImage(urls, title, "pexels");
}

async function tryUnsplash(title, category) {
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  if (!unsplashKey) return null;

  const res = await axios.get("https://api.unsplash.com/search/photos", {
    params: {
      query: getCoverQuery(title, category),
      per_page: 5,
      orientation: "landscape",
      content_filter: "high",
      order_by: "relevant"
    },
    headers: { Authorization: `Client-ID ${unsplashKey}` },
    timeout: 15000
  });

  const urls = Array.isArray(res.data?.results)
    ? res.data.results.map((photo) => {
        const raw = photo.urls?.raw || photo.urls?.full || photo.urls?.regular;
        if (!raw) return "";
        const separator = raw.includes("?") ? "&" : "?";
        return `${raw}${separator}w=1200&h=630&fit=crop&crop=entropy&auto=format&q=85`;
      })
    : [];

  return uploadFirstWorkingImage(urls, title, "unsplash");
}

async function tryGoogleCustomSearch(title, category) {
  const googleKey = process.env.GOOGLE_API_KEY;
  const googleCx = process.env.GOOGLE_CSE_ID;
  if (!googleKey || !googleCx) return null;

  const res = await axios.get("https://www.googleapis.com/customsearch/v1", {
    params: {
      key: googleKey,
      cx: googleCx,
      q: getCoverQuery(title, category),
      searchType: "image",
      imgSize: "large",
      imgType: "photo",
      num: 5,
      safe: "active"
    },
    timeout: 15000
  });

  const urls = Array.isArray(res.data?.items) ? res.data.items.map((item) => item.link) : [];
  return uploadFirstWorkingImage(urls, title, "google");
}

async function tryPollinations(title, category) {
  let promptPrefix = "modern realistic technology news blog cover, editorial style, no text";

  if (category === "Indian News") promptPrefix = "modern professional Indian news editorial cover, realistic photo style, no text";
  else if (category === "College Life" || category === "Student Life") promptPrefix = "realistic student campus life editorial photo style, no text";
  else if (category === "Startup & Business") promptPrefix = "realistic business innovation startup office editorial cover, no text";
  else if (category === "Social Media Trends") promptPrefix = "realistic social media digital culture editorial photo style, no text";
  else if (category === "Artificial Intelligence") promptPrefix = "realistic artificial intelligence technology newsroom editorial cover, no text";

  const prompt = `${promptPrefix}, ${title}`;
  const url = "https://image.pollinations.ai/prompt/" + encodeURIComponent(prompt);
  const res = await axios.get(url, { responseType: "arraybuffer", timeout: 15000 });
  const mime = res.headers["content-type"] || "";
  const { buffer, format } = await ensureSupportedFormat(Buffer.from(res.data), mime);
  const uploaded = await uploadBufferToCloudinary(buffer, getPublicId(title, "pollinations"), format);
  return { url: uploaded, source: "pollinations" };
}

async function tryGeminiImages(title, category) {
  const prompt = `realistic editorial news blog cover photo about: ${title}, ${category}, no text, high quality, 16:9`;
  const model = "imagen-3.0-generate-002";
  const result = await genAI.models.generateImages({
    model,
    prompt,
    config: { numberOfImages: 1, aspectRatio: "16:9" }
  });
  if (!result?.generatedImages?.[0]?.image?.imageBytes) return null;
  const raw = Buffer.from(result.generatedImages[0].image.imageBytes, "base64");
  const { buffer, format } = await ensureSupportedFormat(raw, "image/jpeg");
  const url = await uploadBufferToCloudinary(buffer, getPublicId(title, "gemini"), format);
  return { url, source: "gemini" };
}

async function generateAndUploadCover(title, category = "Technology") {
  const realImageProviders = [
    tryTavilyImages,
    trySerpApiImages,
    tryPexels,
    tryUnsplash,
    tryGoogleCustomSearch
  ];

  for (const provider of realImageProviders) {
    try {
      const result = await provider(title, category);
      if (result?.url) return result;
    } catch (error) {
      console.log(`${provider.name} failed: ${error.message}`);
    }
  }

  try {
    const viaGemini = await tryGeminiImages(title, category);
    if (viaGemini) return viaGemini;
  } catch (error) {
    console.log(`Gemini cover fallback failed: ${error.message}`);
  }

  try {
    const uploaded = await tryPollinations(title, category);
    if (uploaded) return uploaded;
  } catch (error) {
    console.error("Cover image fallback failed:", error.message);
  }

  const publicId = "ai-blog-covers/default-tech-bg";
  const url = cloudinary.url(publicId, {
    format: "png",
    transformation: [
      { width: 1200, height: 630, crop: "fill" },
      { overlay: { font_family: "Arial", font_size: 60, text_align: "center", text: title.substring(0, 60) }, color: "white", opacity: 90, y: 80 },
      { effect: "brightness:20" }
    ]
  });
  return { url, source: "pollinations" };
}

module.exports = { generateAndUploadCover };

export {};
