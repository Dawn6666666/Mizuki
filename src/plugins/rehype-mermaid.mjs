import { createHash } from "node:crypto";

import { fromHtml } from "hast-util-from-html";
import { h } from "hastscript";
import { visit } from "unist-util-visit";

import { renderMermaidVariants } from "./mermaid-static-renderer.mjs";

const DANGEROUS_SVG_TAGS = new Set([
	"script",
	"iframe",
	"object",
	"embed",
	"audio",
	"video",
]);
const URL_PROPERTY = /^(?:href|xLinkHref|src)$/i;
const DANGEROUS_URL = /^\s*(?:javascript|vbscript|data:text\/html)/i;
const DANGEROUS_CSS = /(?:@import|expression\s*\(|url\s*\(\s*["']?(?!#))/i;

function hasClass(node, className) {
	const value = node.properties?.className;
	return Array.isArray(value)
		? value.includes(className)
		: String(value ?? "")
				.split(/\s+/)
				.includes(className);
}

function normalizeEdgeLabelBaselines(node, insideEdgeLabel = false) {
	if (node.type !== "element") return;
	const isInsideEdgeLabel = insideEdgeLabel || hasClass(node, "edgeLabel");

	if (
		isInsideEdgeLabel &&
		node.tagName === "tspan" &&
		hasClass(node, "text-outer-tspan") &&
		node.properties?.dy === "1.1em"
	) {
		// svgdom measures this Mermaid tspan at the zero baseline, while browsers
		// also apply its serialized 1em line offset. Keep the measured geometry.
		node.properties.dy = "0.1em";
	}

	for (const child of node.children ?? []) {
		normalizeEdgeLabelBaselines(child, isInsideEdgeLabel);
	}
}

function diagramSeed(filePath, index, code, rendererVersion) {
	const hash = createHash("sha256")
		.update(`${rendererVersion}\0${filePath || "content"}\0${index}\0${code}`)
		.digest("hex")
		.slice(0, 16);
	return `mermaid-${hash}`;
}

export function assertSafeMermaidSvg(svg) {
	visit(svg, "element", (node) => {
		if (DANGEROUS_SVG_TAGS.has(node.tagName)) {
			throw new Error(`Unsafe Mermaid SVG tag: <${node.tagName}>`);
		}

		for (const [name, rawValue] of Object.entries(node.properties ?? {})) {
			if (/^on/i.test(name)) {
				throw new Error(`Unsafe Mermaid SVG event attribute: ${name}`);
			}
			const value = Array.isArray(rawValue)
				? rawValue.join(" ")
				: String(rawValue ?? "");
			if (URL_PROPERTY.test(name) && DANGEROUS_URL.test(value)) {
				throw new Error(`Unsafe Mermaid SVG URL in ${name}`);
			}
			if (name === "style" && DANGEROUS_CSS.test(value)) {
				throw new Error("Unsafe Mermaid SVG inline style");
			}
		}

		if (node.tagName === "style") {
			const css = (node.children ?? [])
				.filter((child) => child.type === "text")
				.map((child) => child.value)
				.join("");
			if (DANGEROUS_CSS.test(css)) {
				throw new Error("Unsafe Mermaid SVG stylesheet");
			}
		}
	});
}

function parseSvg(svgSource, theme) {
	const tree = fromHtml(svgSource, { fragment: true });
	const svg = tree.children.find(
		(node) => node.type === "element" && node.tagName === "svg",
	);
	if (!svg) throw new Error("Mermaid renderer did not return an SVG root");

	normalizeEdgeLabelBaselines(svg);
	visit(svg, "element", (node) => {
		if (Object.hasOwn(node.properties ?? {}, "dataType")) {
			node.properties.dataMermaidType = node.properties.dataType;
			delete node.properties.dataType;
		}
		if (Object.hasOwn(node.properties ?? {}, "textHeight")) {
			node.properties.dataMermaidTextHeight = node.properties.textHeight;
			delete node.properties.textHeight;
		}
	});
	assertSafeMermaidSvg(svg);
	const existingClasses = Array.isArray(svg.properties?.className)
		? svg.properties.className
		: String(svg.properties?.className ?? "")
				.split(/\s+/)
				.filter(Boolean);
	svg.properties = {
		...svg.properties,
		className: [...existingClasses, "mermaid-svg", `mermaid-svg--${theme}`],
		role: "img",
		ariaLabel: `Mermaid diagram (${theme} theme)`,
		dataMermaidRenderer: "official",
		dataMermaidTheme: theme,
	};
	return svg;
}

function createFallback(code, error) {
	const message = error instanceof Error ? error.message : String(error);
	return h("div", { class: "mermaid-error", role: "alert" }, [
		h(
			"p",
			{ class: "mermaid-error__title" },
			"Mermaid diagram could not be rendered.",
		),
		h("p", { class: "mermaid-error__message" }, message),
		h("pre", { class: "mermaid-source" }, [h("code", {}, code)]),
	]);
}

function applyRenderedDiagram(node, code, seed, variants) {
	const light = parseSvg(variants.light, "light");
	const dark = parseSvg(variants.dark, "dark");
	node.tagName = "div";
	node.properties = {
		className: ["mermaid-diagram-container"],
		dataDiagramId: seed,
	};
	node.children = [
		h("div", { class: "mermaid-wrapper", id: seed }, [
			h(
				"div",
				{
					class: "mermaid",
					dataMermaidStatic: "true",
					dataMermaidCode: code,
				},
				[h("div", { class: "mermaid-static-variants" }, [light, dark])],
			),
		]),
	];
}

export function rehypeMermaid(options = {}) {
	const render = options.renderer ?? renderMermaidVariants;
	const errorMode = options.errorMode === "error" ? "error" : "warn";
	const rendererVersion = options.rendererVersion ?? "official-node-v4-custom";
	const fontMode = options.fontMode === "system" ? "system" : "custom";
	const report = options.onDiagnostic ?? ((message) => console.warn(message));

	return async (tree, file = {}) => {
		const diagrams = [];
		visit(tree, "element", (node) => {
			if (node.tagName === "div" && hasClass(node, "mermaid-container")) {
				diagrams.push(node);
			}
		});

		await Promise.all(
			diagrams.map(async (node, index) => {
				const code = String(
					node.properties?.dataMermaidCode ??
						node.properties?.["data-mermaid-code"] ??
						"",
				);
				const seed = diagramSeed(file.path, index, code, rendererVersion);
				try {
					const variants = await render(code, seed, { fontMode });
					applyRenderedDiagram(node, code, seed, variants);
				} catch (error) {
					const message = `[rehype-mermaid] ${file.path || "content"} diagram ${index + 1}: ${error instanceof Error ? error.message : String(error)}`;
					if (errorMode === "error") throw new Error(message, { cause: error });
					report(message);
					node.tagName = "div";
					node.properties = { className: ["mermaid-diagram-container"] };
					node.children = [createFallback(code, error)];
				}
			}),
		);
	};
}
