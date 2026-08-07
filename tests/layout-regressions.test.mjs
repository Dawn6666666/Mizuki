import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

const layoutSource = await readFile(
	new URL("../src/layouts/Layout.astro", import.meta.url),
	"utf8",
);
const bannerStyles = await readFile(
	new URL("../src/styles/banner.css", import.meta.url),
	"utf8",
);
const mainStyles = await readFile(
	new URL("../src/styles/main.css", import.meta.url),
	"utf8",
);
const packageConfig = JSON.parse(
	await readFile(new URL("../package.json", import.meta.url), "utf8"),
);

describe("Global style loading regressions", () => {
	it("loads shared styles from the root layout and verifies the build output", () => {
		for (const stylesheet of [
			"variables.styl",
			"banner.css",
			"transition.css",
			"widget-responsive.css",
		]) {
			assert.ok(
				layoutSource.includes(`import "../styles/${stylesheet}";`),
				`${stylesheet} must be an explicit root layout dependency`,
			);
		}

		assert.doesNotMatch(
			mainStyles,
			/@import\s+["']\.\/(?:banner|transition)\.css/,
		);
		assert.match(
			packageConfig.scripts.build,
			/node scripts\/check-global-style-loading\.mjs/,
		);
	});
});

describe("Fullscreen banner layout regressions", () => {
	it("does not apply the standard banner sticky compensation in fullscreen", () => {
		assert.match(
			bannerStyles,
			/body\.enable-banner\.fullscreen-banner #main-grid\s*\{[^}]*transform:\s*translateY\(0\)/s,
			"fullscreen must continue to remove the banner extension transform",
		);

		for (const stickyId of [
			"sidebar-sticky",
			"left-sidebar-sticky",
			"right-sidebar-sticky",
		]) {
			assert.ok(
				layoutSource.includes(
					`.enable-banner:not(.fullscreen-banner) #${stickyId}`,
				),
				`${stickyId} must exclude fullscreen from the banner offset compensation`,
			);
			assert.ok(
				!layoutSource.includes(`.enable-banner #${stickyId}`),
				`${stickyId} must not use the unscoped banner offset compensation`,
			);
		}
	});
});
