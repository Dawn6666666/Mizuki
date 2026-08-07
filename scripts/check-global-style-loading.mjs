import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	"..",
);
const distDirectory = path.join(projectRoot, "dist");
const indexPath = path.join(distDirectory, "index.html");
const indexHtml = await readFile(indexPath, "utf8");

function getAttribute(tag, name) {
	const match = tag.match(
		new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i"),
	);
	return match?.[1] ?? match?.[2] ?? match?.[3];
}

const stylesheetUrls = [...indexHtml.matchAll(/<link\b[^>]*>/gi)]
	.map(([tag]) => ({
		href: getAttribute(tag, "href"),
		rel: getAttribute(tag, "rel"),
	}))
	.filter(
		({ href, rel }) =>
			href && rel?.split(/\s+/).some((value) => value === "stylesheet"),
	)
	.map(({ href }) => href);

const inlineStyles = [
	...indexHtml.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi),
]
	.map((match) => match[1])
	.join("\n");

const linkedStyles = await Promise.all(
	stylesheetUrls.map(async (stylesheetUrl) => {
		const pathname = decodeURIComponent(stylesheetUrl.split(/[?#]/, 1)[0]);
		if (/^(?:[a-z]+:)?\/\//i.test(pathname) || pathname.startsWith("data:")) {
			return "";
		}

		const assetPath = path.resolve(
			distDirectory,
			pathname.startsWith("/") ? pathname.slice(1) : pathname,
		);
		const relativePath = path.relative(distDirectory, assetPath);
		if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
			throw new Error(`Stylesheet escapes dist directory: ${stylesheetUrl}`);
		}

		return readFile(assetPath, "utf8");
	}),
);

const loadedCss = `${inlineStyles}\n${linkedStyles.join("\n")}`;
const requiredRules = [
	["--page-bg:", "page background variable"],
	["--card-bg:", "card background variable"],
	["--radius-large:", "shared radius variable"],
	["#banner-carousel", "banner layout styles"],
	[".widget-container", "responsive widget styles"],
];
const missingRules = requiredRules
	.filter(([token]) => !loadedCss.includes(token))
	.map(([, description]) => description);

if (missingRules.length > 0) {
	const loadedStylesheets = stylesheetUrls.join(", ") || "none";
	throw new Error(
		`Homepage is missing global styles: ${missingRules.join(", ")}. ` +
			`Loaded stylesheets: ${loadedStylesheets}`,
	);
}

console.log(
	"Verified homepage global styles across " +
		`${stylesheetUrls.length} linked stylesheet(s).`,
);
