import { createHash } from "node:crypto";

import { renderBrowserlessMermaid } from "./mermaid-browserless-renderer.mjs";

const renderCache = new Map();

async function renderVariant(code, theme, seed) {
	const cacheKey = createHash("sha256")
		.update(`${seed}\0${theme}\0${code}`)
		.digest("hex");
	if (!renderCache.has(cacheKey)) {
		renderCache.set(
			cacheKey,
			Promise.resolve().then(() => renderBrowserlessMermaid(code, theme, seed)),
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
