/* "Dell Inspiron 15!" -> "dell-inspiron-15" */
const slugify = (text) =>
  String(text)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export default slugify;
