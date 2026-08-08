import { createHash } from "node:crypto";
import { existsSync } from "node:fs";

import { createMermaidRenderer } from "mermaid-isomorphic";
import { chromium } from "playwright";

const LIGHT_THEME = {
	theme: "default",
	themeVariables: {
		fontFamily: "inherit",
		fontSize: "16px",
		primaryColor: "#f8fafc",
		primaryTextColor: "#0f172a",
		primaryBorderColor: "#64748b",
		lineColor: "#475569",
		secondaryColor: "#e2e8f0",
		tertiaryColor: "#f1f5f9",
	},
};

const DARK_THEME = {
	theme: "dark",
	themeVariables: {
		fontFamily: "inherit",
		fontSize: "16px",
		primaryColor: "#1e293b",
		primaryTextColor: "#f8fafc",
		primaryBorderColor: "#94a3b8",
		lineColor: "#cbd5e1",
		secondaryColor: "#334155",
		tertiaryColor: "#475569",
	},
};

const WINDOWS_BROWSER_PATHS = [
	"C:/Program Files/Google/Chrome/Application/chrome.exe",
	"C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
];
const UNIX_BROWSER_PATHS = [
	"/usr/bin/google-chrome",
	"/usr/bin/google-chrome-stable",
	"/usr/bin/chromium",
	"/usr/bin/chromium-browser",
];

function resolveBrowserExecutable() {
	const configured = process.env.MIZUKI_MERMAID_BROWSER;
	if (configured && existsSync(configured)) return configured;

	const bundled = chromium.executablePath();
	if (bundled && existsSync(bundled)) return bundled;

	return [...WINDOWS_BROWSER_PATHS, ...UNIX_BROWSER_PATHS].find((candidate) =>
		existsSync(candidate),
	);
}

const executablePath = resolveBrowserExecutable();
const renderer = createMermaidRenderer({
	launchOptions: {
		headless: true,
		...(executablePath ? { executablePath } : {}),
	},
});
const renderCache = new Map();

function renderOptions(theme, seed) {
	const palette = theme === "dark" ? DARK_THEME : LIGHT_THEME;
	return {
		prefix: `${seed}-${theme}`,
		mermaidOptions: {
			startOnLoad: false,
			securityLevel: "strict",
			deterministicIds: true,
			deterministicIDSeed: `${seed}-${theme}`,
			htmlLabels: false,
			flowchart: { htmlLabels: false },
			...palette,
		},
	};
}

async function renderVariant(code, theme, seed) {
	const cacheKey = createHash("sha256")
		.update(`${seed}\0${theme}\0${code}`)
		.digest("hex");
	if (!renderCache.has(cacheKey)) {
		renderCache.set(
			cacheKey,
			renderer([code], renderOptions(theme, seed)).then(([result]) => {
				if (!result || result.status === "rejected") {
					throw result?.reason ?? new Error("Mermaid returned no render result");
				}
				return result.value.svg;
			}),
		);
	}
	return renderCache.get(cacheKey);
}

export async function renderMermaidVariants(code, seed) {
	const [light, dark] = await Promise.all([
		renderVariant(code, "light", seed),
		renderVariant(code, "dark", seed),
	]);
	return { light, dark };
}
