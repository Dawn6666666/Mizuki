import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
	encodePlantUML,
	injectPlantUMLTheme,
	plantUMLUrl,
} from "../src/plugins/plantuml-encoder.mjs";
import { remarkAutoImageGrid } from "../src/plugins/remark-auto-image-grid.mjs";
import { remarkFixGithubAdmonitions } from "../src/plugins/remark-fix-github-admonitions.js";
import { remarkPlantuml } from "../src/plugins/remark-plantuml.mjs";
import { remarkWikiLink } from "../src/plugins/remark-wiki-link.mjs";

describe("PlantUML markdown pipeline", () => {
	it("encodes source and injects a theme after @startuml", () => {
		const source = "@startuml\nAlice -> Bob\n@enduml";
		const themed = injectPlantUMLTheme(source, "cyborg");
		assert.match(themed, /^@startuml\n!theme cyborg\n/);
		const encoded = encodePlantUML(themed);
		assert.match(encoded, /^[0-9A-Za-z_-]+$/);
		assert.equal(
			plantUMLUrl("https://plantuml.example/", encoded),
			`https://plantuml.example/svg/${encoded}`,
		);
	});

	it("converts plantuml fences to diagram source nodes", () => {
		const tree = {
			type: "root",
			children: [
				{ type: "code", lang: "plantuml", value: "@startuml\nA -> B\n@enduml" },
			],
		};
		remarkPlantuml({
			server: "https://plantuml.example",
			darkTheme: "cyborg",
		})(tree);
		assert.equal(tree.children[0].type, "plantuml");
		assert.match(
			tree.children[0].data.hProperties.dataPlantumlLight,
			/^https:\/\/plantuml\.example\/svg\//,
		);
	});
});

describe("Markdown AST enhancements", () => {
	it("groups consecutive standalone images", () => {
		const image = (url) => ({
			type: "paragraph",
			children: [{ type: "image", url, alt: "" }],
		});
		const tree = {
			type: "root",
			children: [
				image("/a.png"),
				image("/b.png"),
				{ type: "paragraph", children: [] },
			],
		};
		remarkAutoImageGrid({ minImages: 2, maxColumns: 4 })(tree);
		assert.equal(tree.children[0].type, "containerDirective");
		assert.equal(tree.children[0].name, "grid");
		assert.equal(tree.children[0].attributes.columns, "2");
		assert.equal(tree.children[0].children.length, 2);
	});

	it("groups adjacent image lines parsed into one paragraph", () => {
		const tree = {
			type: "root",
			children: [
				{
					type: "paragraph",
					children: [
						{ type: "image", url: "/a.png", alt: "" },
						{ type: "text", value: "\n" },
						{ type: "image", url: "/b.png", alt: "" },
					],
				},
			],
		};
		remarkAutoImageGrid({ minImages: 2, maxColumns: 4 })(tree);
		assert.equal(tree.children[0].name, "grid");
		assert.equal(tree.children[0].attributes.columns, "2");
	});

	it("supports extended GitHub/Obsidian callout aliases and titles", () => {
		const tree = {
			type: "root",
			children: [
				{
					type: "blockquote",
					children: [
						{
							type: "paragraph",
							children: [
								{ type: "text", value: "[!BUG] Known issue\nDetails" },
							],
						},
					],
				},
			],
		};
		remarkFixGithubAdmonitions()(tree);
		assert.equal(tree.children[0].type, "containerDirective");
		assert.equal(tree.children[0].name, "caution");
		assert.equal(tree.children[0].attributes.title, "Known issue");
	});

	it("turns standalone wiki links into post cards and inline links into links", () => {
		const tree = {
			type: "root",
			children: [
				{
					type: "paragraph",
					children: [{ type: "text", value: "[[markdown-extended]]" }],
				},
				{
					type: "paragraph",
					children: [
						{
							type: "text",
							value: "See [[markdown-extended|extended syntax]].",
						},
					],
				},
			],
		};
		remarkWikiLink()(tree);
		assert.equal(tree.children[0].data.hName, "a");
		assert.match(tree.children[0].data.hProperties.class, /card-wiki-link/);
		assert.equal(tree.children[1].children[1].type, "link");
		assert.equal(
			tree.children[1].children[1].children[0].value,
			"extended syntax",
		);
	});
});
