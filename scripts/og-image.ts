// Draws public/og-image.png, the 1200×630 link-preview card: the name and what it does on the left,
// the logo's three circles on the right, each named for a section. Run with `npm run og-image`.
// Text renders in the first installed font of FONT; the site itself uses Inter.
import sharp from 'sharp';

const LIME = '#a3e635';
const TEXT = '#f4f4f5';
const MUTED = '#a1a1aa';
const FONT = "Inter, 'Segoe UI', Roboto, sans-serif";

// The favicon's circles (64-unit box), scaled ×7.5 and centred at (935, 318).
const k = 7.5;
const CX = 935;
const CY = 318;
const at = (x: number, y: number) => [CX + (x - 32) * k, CY + (y - 29.5) * k] as const;
const circles = [at(25, 25), at(39, 25), at(32, 37)];
const r = 13 * k;

/** A section beside its circle: the verb from the motto, then the section's name. */
const label = (x: number, y: number, verb: string, name: string, anchor = 'middle') => `
  <text x="${x}" y="${y}" text-anchor="${anchor}" font-size="30" font-weight="700" fill="${TEXT}">${verb}</text>
  <text x="${x}" y="${y + 30}" text-anchor="${anchor}" font-size="22" fill="${MUTED}">${name}</text>`;

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#0a0a0b"/>
  <g font-family="${FONT}">
    <g transform="translate(80 178)">
      <rect width="60" height="60" rx="13" fill="#18181b"/>
      <g fill="none" stroke="${LIME}" stroke-width="3.3" transform="scale(${60 / 64})">
        <circle cx="25" cy="25" r="13"/><circle cx="39" cy="25" r="13"/><circle cx="32" cy="37" r="13"/>
      </g>
      <circle cx="${32 * (60 / 64)}" cy="${29.5 * (60 / 64)}" r="3.3" fill="${LIME}"/>
    </g>
    <text x="160" y="232" font-size="64" font-weight="700" fill="${TEXT}">FHIR <tspan fill="${LIME}">Matchbook</tspan></text>
    <text x="80" y="318" font-size="34" font-weight="600" fill="${TEXT}">Find the FHIR guides that apply to you,</text>
    <text x="80" y="362" font-size="34" font-weight="600" fill="${TEXT}">see how they fit, and start building.</text>
    <text x="80" y="566" font-size="24" fill="${MUTED}">standfast-systems.github.io/fhir-matchbook</text>

    <g fill="none" stroke="${LIME}" stroke-width="6">
      ${circles.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}
    </g>
    <g fill="${LIME}" fill-opacity="0.07">
      ${circles.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}
    </g>
    <circle cx="${CX}" cy="${CY}" r="${3.5 * k}" fill="${LIME}"/>
    ${label(circles[0][0] - 40, circles[0][1] - r - 52, 'Discover', 'Browsr')}
    ${label(circles[1][0] + 40, circles[1][1] - r - 52, 'Connect', 'Mappr')}
    ${label(circles[2][0], circles[2][1] + r + 46, 'Build', 'Initializr')}
  </g>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('public/og-image.png');
console.log('public/og-image.png: 1200×630');
