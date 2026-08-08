import { createHash } from "node:crypto";
import { Worker } from "node:worker_threads";

const renderCache = new Map();
const pendingRenders = new Map();
let activeWorker;
let nextRequestId = 0;

function rejectPending(error) {
	for (const { reject } of pendingRenders.values()) reject(error);
	pendingRenders.clear();
}

function createRenderWorker() {
	const worker = new Worker(
		new URL("./mermaid-render-worker.mjs", import.meta.url),
		{
			execArgv: process.execArgv.filter(
				(argument) => !argument.startsWith("--input-type"),
			),
		},
	);
	worker.unref();
	worker.on("message", (message) => {
		const pending = pendingRenders.get(message.id);
		if (!pending) return;
		pendingRenders.delete(message.id);
		if (message.error) {
			const error = new Error(message.error.message);
			error.name = message.error.name;
			error.stack = message.error.stack;
			pending.reject(error);
		} else {
			pending.resolve(message.variants);
		}
		if (pendingRenders.size === 0) worker.unref();
	});
	worker.on("error", (error) => {
		if (activeWorker === worker) activeWorker = undefined;
		rejectPending(error);
	});
	worker.on("exit", (code) => {
		const wasActive = activeWorker === worker;
		if (wasActive) activeWorker = undefined;
		if (wasActive && code !== 0 && pendingRenders.size > 0) {
			rejectPending(
				new Error(`Mermaid render worker exited with code ${code}`),
			);
		}
	});
	return worker;
}

function renderInWorker(code, seed) {
	if (!activeWorker) activeWorker = createRenderWorker();
	const worker = activeWorker;
	const id = ++nextRequestId;
	return new Promise((resolve, reject) => {
		pendingRenders.set(id, { resolve, reject });
		worker.ref();
		worker.postMessage({ id, code, seed });
	});
}

export async function renderMermaidVariants(code, seed) {
	const cacheKey = createHash("sha256")
		.update(`${seed}\0${code}`)
		.digest("hex");
	if (!renderCache.has(cacheKey)) {
		renderCache.set(cacheKey, renderInWorker(code, seed));
	}
	return renderCache.get(cacheKey);
}
