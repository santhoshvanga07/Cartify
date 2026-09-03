/**
 * Generates a product image as an SVG data URI.
 *
 * Why this exists: a shop full of grey boxes looks broken, and real photos
 * need a working Cloudinary key. These are deterministic per brand - the same
 * brand always gets the same colour - so the catalogue looks designed rather
 * than random.
 *
 * They are marked with publicId "generated:<slug>" so a real uploaded photo
 * can replace them later and we can tell the two apart.
 */

/** Stable hue from a string: same brand in, same colour out, every time. */
const hueFrom = (text) => {
  let hash = 0;
  for (let i = 0; i < text.length; i++) {
    hash = (hash << 5) - hash + text.charCodeAt(i);
    hash |= 0; // force 32-bit
  }
  return Math.abs(hash) % 360;
};

/* SVG is XML, so these five characters must be escaped or the file is invalid. */
const escapeXml = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

export const buildProductSvg = ({ name, brand }) => {
  const hue = hueFrom(brand);
  const initial = escapeXml(brand.charAt(0).toUpperCase());
  const label = escapeXml(brand.toUpperCase().slice(0, 18));

  // Muted, low-saturation colours so the grid stays calm rather than gaudy.
  const from = `hsl(${hue}, 32%, 88%)`;
  const to = `hsl(${(hue + 28) % 360}, 26%, 76%)`;
  const ink = `hsl(${hue}, 30%, 28%)`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600" width="600" height="600">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="${from}"/>
      <stop offset="1" stop-color="${to}"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bg)"/>
  <circle cx="300" cy="262" r="158" fill="#ffffff" opacity="0.34"/>
  <text x="300" y="322" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif"
        font-size="180" fill="${ink}" opacity="0.72">${initial}</text>
  <text x="300" y="486" text-anchor="middle" font-family="Helvetica, Arial, sans-serif"
        font-size="26" letter-spacing="7" fill="${ink}" opacity="0.62">${label}</text>
</svg>`;
};

/** Data URI the browser can render directly from an <img src>. */
export const buildProductImageDataUri = (product) =>
  'data:image/svg+xml;base64,' + Buffer.from(buildProductSvg(product), 'utf8').toString('base64');

export default buildProductImageDataUri;
