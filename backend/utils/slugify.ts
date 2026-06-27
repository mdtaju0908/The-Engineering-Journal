/**
 * Generates a strict SEO-friendly slug from a title.
 * 
 * Rules:
 * 1. Convert the entire title to lowercase.
 * 2. Remove all special characters such as : ; " ' , ? ! ( ) [ ] { } & % $ # @.
 * 3. Replace spaces with hyphens (-).
 * 4. Remove duplicate hyphens.
 * 5. Trim hyphens from the start and end.
 * 6. The final slug must contain only lowercase letters, numbers, and hyphens.
 * 7. Do not include any punctuation marks.
 * 
 * @param {string} title 
 * @returns {string}
 */
function slugify(title) {
  if (!title) return '';

  return title
    .toLowerCase() // Rule 1: Lowercase
    .replace(/[:;"',?!()[\]{}&%$#@]/g, '') // Rule 2: Remove listed special characters
    .replace(/[^a-z0-9\s-]/g, '') // Rule 6 & 7: Ensure only lowercase letters, numbers, spaces, or hyphens (removes other punctuation)
    .trim() // Initial trim
    .replace(/\s+/g, '-') // Rule 3: Replace spaces with hyphens
    .replace(/-+/g, '-') // Rule 4: Remove duplicate hyphens
    .replace(/^-+|-+$/g, ''); // Rule 5: Trim hyphens from start and end
}

module.exports = slugify;

export {};
