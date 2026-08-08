import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { renderMermaidVariants } from "../src/plugins/mermaid-static-renderer.mjs";
import {
	assertSafeMermaidSvg,
	rehypeMermaid,
} from "../src/plugins/rehype-mermaid.mjs";

const layoutSource = await readFile(
	new URL("../src/layouts/Layout.astro", import.meta.url),
	"utf8",
);
const astroConfigSource = await readFile(
	new URL("../astro.config.mjs", import.meta.url),
	"utf8",
);
const managerSource = await readFile(
	new URL(
		"../src/components/features/markdown/MermaidManager.astro",
		import.meta.url,
	),
	"utf8",
);
const rehypeSource = await readFile(
	new URL("../src/plugins/rehype-mermaid.mjs", import.meta.url),
	"utf8",
);
const interactionSource = await readFile(
	new URL("../src/plugins/mermaid-render-script.js", import.meta.url),
	"utf8",
);
const markdownStyles = await readFile(
	new URL("../src/styles/markdown-extend.styl", import.meta.url),
	"utf8",
);
const expressiveCodeStyles = await readFile(
	new URL("../src/styles/expressive-code.css", import.meta.url),
	"utf8",
);
const packageSource = await readFile(
	new URL("../package.json", import.meta.url),
	"utf8",
);

describe("Mermaid interaction regressions", () => {
	it("loads one lazy Mermaid manager instead of embedding the runtime per diagram", () => {
		assert.match(layoutSource, /import MermaidManager/);
		assert.match(layoutSource, /<MermaidManager\s*\/>/);
		assert.match(
			managerSource,
			/import "@\/plugins\/mermaid-render-script\.js"/,
		);
		assert.match(managerSource, /<script>/);
		assert.doesNotMatch(managerSource, /is:inline|\?raw/);
		assert.doesNotMatch(
			rehypeSource,
			/mermaidRenderScript|h\(\s*["']script["']/,
		);
		assert.match(interactionSource, /data-mermaid-static/);
		assert.doesNotMatch(interactionSource, /jsdelivr|unpkg|securityLevel/);
	});

	it("emits deterministic light and dark static SVG markup", async () => {
		const tree = {
			type: "root",
			children: [
				{
					type: "element",
					tagName: "div",
					properties: {
						className: ["mermaid-container"],
						"data-mermaid-code": "graph TD; A-->B",
					},
					children: [],
				},
			],
		};

		await rehypeMermaid({
			renderer: async (_code, seed) => ({
				light: `<svg id="${seed}-source-light" viewBox="0 0 10 10"><path d="M0 0L10 10"/></svg>`,
				dark: `<svg id="${seed}-source-dark" viewBox="0 0 10 10"><path d="M0 10L10 0"/></svg>`,
			}),
		})(tree, { path: "fixture.md" });
		assert.equal(
			tree.children[0].properties.className[0],
			"mermaid-diagram-container",
		);
		assert.equal(tree.children[0].children.length, 1);
		assert.equal(tree.children[0].children[0].tagName, "div");
		assert.equal(tree.children[0].children[0].children[0].tagName, "div");
		const variants = tree.children[0].children[0].children[0].children[0];
		assert.equal(variants.properties.className[0], "mermaid-static-variants");
		assert.equal(variants.children.length, 2);
		assert.match(
			variants.children[0].properties.id,
			/^mermaid-[a-f0-9]{16}-source-light$/,
		);
		assert.equal(variants.children[0].properties.dataMermaidTheme, "light");
		assert.equal(variants.children[1].properties.dataMermaidTheme, "dark");
	});

	it("renders every documented diagram family without a browser runtime", async () => {
		const documentBeforeRender = globalThis.document;
		const diagrams = [
			"flowchart LR\n  A[Source] --> B[Output]",
			"sequenceDiagram\n  Alice->>Bob: Hello",
			"classDiagram\n  Animal <|-- Duck",
			"stateDiagram-v2\n  [*] --> Ready",
			"erDiagram\n  USER ||--o{ POST : writes",
			"xychart-beta\n  x-axis [A, B]\n  bar [1, 2]",
			"gantt\n  dateFormat YYYY-MM-DD\n  Task :a1, 2026-01-01, 2d",
			'pie title Share\n  "A" : 60\n  "B" : 40',
		];

		for (const [index, diagram] of diagrams.entries()) {
			const seed = `official-${index}`;
			const first = await renderMermaidVariants(diagram, seed);
			const second = await renderMermaidVariants(diagram, seed);
			assert.deepEqual(first, second);
			for (const [theme, svg] of Object.entries(first)) {
				assert.match(svg, /^<svg\b/);
				assert.match(svg, new RegExp(`id="${seed}-${theme}`));
				assert.match(svg, /aria-roledescription=/);
				assert.doesNotMatch(svg, /@import|fonts\.googleapis|<script\b/i);
				assert.doesNotMatch(svg, /\sdatatype=/i);
			}
		}
		assert.equal(globalThis.document, documentBeforeRender);
	});

	it("preserves renderer data attributes through the HAST boundary", async () => {
		const tree = {
			type: "root",
			children: [
				{
					type: "element",
					tagName: "div",
					properties: {
						className: ["mermaid-container"],
						dataMermaidCode:
							"sequenceDiagram\n  participant Alice\n  Alice->>Alice: Ready",
					},
					children: [],
				},
			],
		};
		await rehypeMermaid()(tree, { path: "sequence.md" });
		const serialized = JSON.stringify(tree);
		assert.match(serialized, /"dataMermaidRenderer":"official"/);
		assert.match(serialized, /"dataMermaidType":"participant"/);
		assert.doesNotMatch(serialized, /"dataType":/);
		assert.match(serialized, /"ariaRoleDescription":\["sequence"\]/);
	});

	it("has no Playwright, Puppeteer, or browser executable dependency", () => {
		assert.match(packageSource, /"mermaid": "11\.16\.1"/);
		assert.match(packageSource, /"svgdom": "0\.1\.28"/);
		assert.match(
			astroConfigSource,
			/rendererVersion: `official-node-v3-\$\{customFontsEnabled/,
		);
		assert.doesNotMatch(
			packageSource,
			/"(?:beautiful-mermaid|playwright|playwright-core|puppeteer|mermaid-isomorphic)"/,
		);
	});

	it("keeps official Mermaid flowchart layout and theme output", async () => {
		const diagram = `graph TD
			A[Start] --> B{Condition Check}
			B -->|Yes| C[Process Step 1]
			B -->|No| D[Process Step 2]
			C --> E[Subprocess]
			D --> E
			subgraph E [Subprocess Details]
				E1[Substep 1] --> E2[Substep 2]
				E2 --> E3[Substep 3]
			end`;
		const { light, dark } = await renderMermaidVariants(
			diagram,
			"official-layout",
		);
		assert.match(light, /aria-roledescription="flowchart-v2"/);
		assert.match(light, /class="cluster-label\s*"/);
		assert.match(light, /fill:#ECECFF;stroke:#9370DB/i);
		assert.match(dark, /fill:#1f2020;stroke:#ccc/i);
		assert.match(
			light,
			/font-family:var\(--font-body, sans-serif\), var\(--font-cjk, sans-serif\), sans-serif/,
		);
		assert.doesNotMatch(light, /font-family:inherit/);
		const [, width, height] = light.match(
			/viewBox="[^ ]+ [^ ]+ ([\d.]+) ([\d.]+)"/,
		);
		assert.ok(Number(width) > 500, "official Dagre layout should stay wide");
		assert.ok(Number(height) > 500, "subgraph should retain its full height");
	});

	it("keeps class relation labels aligned with the measured font", async () => {
		const diagram = `classDiagram
			class User {
				+String username
				+login()
			}
			class Article {
				+String title
				+publish()
			}
			User "1" -- "*" Article : writes`;
		const { light } = await renderMermaidVariants(
			diagram,
			"official-class-font",
			{ fontMode: "custom" },
		);
		assert.match(
			light,
			/class="edgeLabel" transform="translate\([\d.]+, [\d.]+\)"/,
		);
		assert.match(
			light,
			/<rect class="background"[^>]+x="-[\d.]+"[^>]+width="[\d.]+"/,
		);
		assert.doesNotMatch(light, /ZenMaruGothic-Medium|font-family:inherit/);

		const system = await renderMermaidVariants(
			"classDiagram\n  User -- Article",
			"official-class-system-font",
			{ fontMode: "system" },
		);
		assert.match(system.light, /font-family:sans-serif/);
		assert.doesNotMatch(system.light, /var\(--font-body/);
	});

	it("keeps invalid Mermaid source as a readable build diagnostic", async () => {
		const diagnostics = [];
		const tree = {
			type: "root",
			children: [
				{
					type: "element",
					tagName: "div",
					properties: {
						className: ["mermaid-container"],
						dataMermaidCode: "not valid Mermaid",
					},
					children: [],
				},
			],
		};

		await rehypeMermaid({
			renderer: async () => {
				throw new Error("Parse error on line 1");
			},
			onDiagnostic: (message) => diagnostics.push(message),
		})(tree, { path: "invalid.md" });

		assert.equal(diagnostics.length, 1);
		assert.match(diagnostics[0], /invalid\.md diagram 1: Parse error/);
		const fallback = tree.children[0].children[0];
		assert.equal(fallback.properties.className[0], "mermaid-error");
		assert.equal(fallback.children[2].tagName, "pre");
		assert.equal(
			fallback.children[2].children[0].children[0].value,
			"not valid Mermaid",
		);
	});

	it("rejects executable SVG tags, event handlers, and dangerous URLs", () => {
		for (const node of [
			{ type: "element", tagName: "script", properties: {}, children: [] },
			{
				type: "element",
				tagName: "path",
				properties: { onClick: "alert(1)" },
				children: [],
			},
			{
				type: "element",
				tagName: "a",
				properties: { href: "javascript:alert(1)" },
				children: [],
			},
		]) {
			assert.throws(() => assertSafeMermaidSvg(node), /Unsafe Mermaid SVG/);
		}
	});

	it("keeps fullscreen in the shared toolbar and the draggable viewport separate", () => {
		assert.doesNotMatch(
			interactionSource,
			/injectFullscreenStyles|mermaid-fullscreen-btn/,
		);
		assert.match(interactionSource, /name: "fullscreen"/);
		assert.match(
			interactionSource,
			/viewport\.addEventListener\(\s*"pointerdown"/s,
		);
		assert.match(
			interactionSource,
			/attachDiagramInteraction\(stage, clonedSvg\)/,
		);
		assert.match(
			markdownStyles,
			/\.mermaid-viewport\s+[\s\S]*?touch-action: none/,
		);
		assert.match(
			markdownStyles,
			/\.mermaid-fullscreen-stage[\s\S]*?\.mermaid-zoom-controls\s+top: \.75rem\s+right: auto\s+bottom: auto\s+left: \.75rem/,
		);
		assert.doesNotMatch(expressiveCodeStyles, /mermaid-fullscreen-btn/);
	});

	it("cleans up fullscreen listeners and restores keyboard focus", () => {
		assert.match(interactionSource, /session\.eventController\.abort\(\)/);
		assert.match(interactionSource, /session\.diagramController\.destroy\(\)/);
		assert.match(
			interactionSource,
			/session\.previousFocus\.focus\(\{ preventScroll: true \}\)/,
		);
		assert.match(interactionSource, /aria-modal/);
		assert.match(interactionSource, /event\.key === "Escape"/);
	});
});
