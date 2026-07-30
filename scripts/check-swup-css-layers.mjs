import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { glob } from "glob";

const distDir = resolve("dist");
const htmlFiles = await glob("**/*.html", {
	cwd: distDir,
	absolute: true,
	nodir: true,
});

if (htmlFiles.length === 0) {
	throw new Error(`No generated HTML files found in ${distDir}`);
}

const expectedLayerOrder =
	"@layerproperties,theme,base,components,utilities;";
const failures = [];
let checkedPages = 0;

for (const file of htmlFiles) {
	const html = await readFile(file, "utf8");
	if (!html.includes("data-overlayscrollbars-initialize")) {
		continue;
	}
	checkedPages += 1;

	const markedStyles = [
		...html.matchAll(
			/<style\b[^>]*\bdata-tailwind-layer-order\b[^>]*>[\s\S]*?<\/style>/gi,
		),
	];

	if (markedStyles.length !== 1) {
		failures.push(
			`${file}: expected exactly one data-tailwind-layer-order style, found ${markedStyles.length}`,
		);
		continue;
	}

	const marker = markedStyles[0];
	const normalizedMarker = marker[0]
		.replace(/<style\b[^>]*>|<\/style>/gi, "")
		.replace(/\s+/g, "");

	if (normalizedMarker !== expectedLayerOrder) {
		failures.push(`${file}: canonical Tailwind layer order has changed`);
	}

	const markerIndex = marker.index;
	const firstStylesheetIndex = html.search(
		/<link\b(?=[^>]*\brel=["']stylesheet["'])[^>]*>/i,
	);
	if (firstStylesheetIndex !== -1 && markerIndex > firstStylesheetIndex) {
		failures.push(
			`${file}: Tailwind layer order must be declared before stylesheets`,
		);
	}

	const otherLayerStyleIndex = [
		...html.matchAll(/<style\b[^>]*>[\s\S]*?<\/style>/gi),
	]
		.filter((match) => !match[0].includes("data-tailwind-layer-order"))
		.find((match) => /@layer\b/i.test(match[0]))?.index;

	if (
		otherLayerStyleIndex !== undefined &&
		markerIndex > otherLayerStyleIndex
	) {
		failures.push(
			`${file}: Tailwind layer order must precede page-specific layer declarations`,
		);
	}
}

if (checkedPages === 0) {
	throw new Error(`No generated Mizuki layout pages found in ${distDir}`);
}

if (failures.length > 0) {
	throw new Error(
		`Swup/Tailwind CSS layer invariant failed:\n${failures.join("\n")}`,
	);
}

console.log(
	`Verified canonical Tailwind layer order in ${checkedPages} generated Mizuki pages.`,
);
