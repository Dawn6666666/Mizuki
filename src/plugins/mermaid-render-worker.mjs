import { fileURLToPath } from "node:url";
import { parentPort } from "node:worker_threads";

import * as svgdom from "svgdom";

const CUSTOM_FONT_FAMILY = "ZenMaruGothic-Medium, sans-serif";
const CUSTOM_OUTPUT_FONT_FAMILY =
	"var(--font-body, sans-serif), var(--font-cjk, sans-serif), sans-serif";
const SYSTEM_FONT_FAMILY = "sans-serif";

const LIGHT_THEME = {
	theme: "default",
	themeVariables: {
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
		fontSize: "16px",
		primaryColor: "#1e293b",
		primaryTextColor: "#f8fafc",
		primaryBorderColor: "#94a3b8",
		lineColor: "#cbd5e1",
		secondaryColor: "#334155",
		tertiaryColor: "#475569",
	},
};

svgdom.config
	.setFontDir(fileURLToPath(new URL("../../", import.meta.url)))
	.setFontFamilyMappings({
		"ZenMaruGothic-Medium": "src/assets/fonts/ZenMaruGothic-Medium.ttf",
		"sans-serif": "node_modules/svgdom/fonts/OpenSans-Regular.ttf",
		"Open Sans": "node_modules/svgdom/fonts/OpenSans-Regular.ttf",
	})
	.preloadFonts();

class HeadlessStyleSheet {
	cssRules = [];

	insertRule(cssText, index = this.cssRules.length) {
		this.cssRules.splice(index, 0, { cssText });
		return index;
	}

	replaceSync(cssText) {
		this.cssRules = [{ cssText }];
	}
}

function installHeadlessDom() {
	const window = svgdom.createHTMLWindow();
	const { document } = window;

	if (
		!Object.getOwnPropertyDescriptor(svgdom.Element.prototype, "parentElement")
	) {
		Object.defineProperty(svgdom.Element.prototype, "parentElement", {
			configurable: true,
			get() {
				return this.parentNode?.nodeType === 1 ? this.parentNode : null;
			},
		});
	}
	if (
		!Object.getOwnPropertyDescriptor(
			svgdom.HTMLElement.prototype,
			"offsetWidth",
		)
	) {
		Object.defineProperty(svgdom.HTMLElement.prototype, "offsetWidth", {
			configurable: true,
			get() {
				return Number.parseFloat(this.style?.width) || 1200;
			},
		});
	}

	const requestAnimationFrame = (callback) => setTimeout(callback, 0);
	const cancelAnimationFrame = (handle) => clearTimeout(handle);
	const navigator = { userAgent: "Mizuki Mermaid build renderer" };
	const getComputedStyle = (element) => element.style;
	const globals = {
		window,
		document,
		navigator,
		Node: svgdom.Node,
		Element: svgdom.Element,
		HTMLElement: svgdom.HTMLElement,
		SVGElement: svgdom.SVGElement,
		SVGGraphicsElement: svgdom.SVGGraphicsElement,
		CSSStyleSheet: HeadlessStyleSheet,
		getComputedStyle,
		requestAnimationFrame,
		cancelAnimationFrame,
	};

	Object.assign(window, globals);
	for (const [name, value] of Object.entries(globals)) {
		Object.defineProperty(globalThis, name, {
			configurable: true,
			writable: true,
			value,
		});
	}
}

installHeadlessDom();
const mermaid = (await import("mermaid")).default;

function renderOptions(theme, seed, fontMode) {
	const palette = theme === "dark" ? DARK_THEME : LIGHT_THEME;
	const fontFamily =
		fontMode === "system" ? SYSTEM_FONT_FAMILY : CUSTOM_FONT_FAMILY;
	return {
		startOnLoad: false,
		// svgdom deliberately implements geometry instead of a full browser DOM.
		// The HAST boundary performs the authoritative SVG safety validation.
		securityLevel: "loose",
		deterministicIds: true,
		deterministicIDSeed: `${seed}-${theme}`,
		htmlLabels: false,
		flowchart: { htmlLabels: false },
		gantt: { useWidth: 1200 },
		...palette,
		themeVariables: {
			...palette.themeVariables,
			fontFamily,
		},
	};
}

async function renderVariant(code, theme, seed, fontMode) {
	mermaid.initialize(renderOptions(theme, seed, fontMode));
	const { svg } = await mermaid.render(`${seed}-${theme}`, code);
	if (!svg?.startsWith("<svg")) {
		throw new Error("Mermaid returned no SVG output");
	}
	return fontMode === "system"
		? svg
		: svg.replaceAll(
				/ZenMaruGothic-Medium,\s*sans-serif/g,
				CUSTOM_OUTPUT_FONT_FAMILY,
			);
}

async function renderVariants(code, seed, fontMode) {
	const light = await renderVariant(code, "light", seed, fontMode);
	const dark = await renderVariant(code, "dark", seed, fontMode);
	return { light, dark };
}

function errorPayload(error) {
	return {
		name: error instanceof Error ? error.name : "Error",
		message: error instanceof Error ? error.message : String(error),
		stack: error instanceof Error ? error.stack : undefined,
	};
}

let renderQueue = Promise.resolve();
parentPort?.on("message", (message) => {
	renderQueue = renderQueue
		.then(async () => {
			const variants = await renderVariants(
				message.code,
				message.seed,
				message.fontMode,
			);
			parentPort?.postMessage({ id: message.id, variants });
		})
		.catch((error) => {
			parentPort?.postMessage({ id: message.id, error: errorPayload(error) });
		});
});
