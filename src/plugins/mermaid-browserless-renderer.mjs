import { renderMermaidSVG } from "beautiful-mermaid";

const DAY_MS = 24 * 60 * 60 * 1000;
const GANTT_FLAGS = new Set(["active", "crit", "done", "milestone"]);

const THEME_OPTIONS = {
	light: {
		bg: "#ffffff",
		fg: "#0f172a",
		line: "#475569",
		accent: "#2563eb",
		muted: "#64748b",
		surface: "#f8fafc",
		border: "#64748b",
		font: "system-ui",
		transparent: true,
	},
	dark: {
		bg: "#0f172a",
		fg: "#f8fafc",
		line: "#cbd5e1",
		accent: "#60a5fa",
		muted: "#94a3b8",
		surface: "#1e293b",
		border: "#94a3b8",
		font: "system-ui",
		transparent: true,
	},
};

const CHART_PALETTES = {
	light: {
		background: "#ffffff",
		foreground: "#0f172a",
		muted: "#64748b",
		grid: "#cbd5e1",
		section: "#f1f5f9",
		task: "#3b82f6",
		active: "#f59e0b",
		done: "#22c55e",
		critical: "#ef4444",
		colors: [
			"#2563eb",
			"#7c3aed",
			"#db2777",
			"#ea580c",
			"#16a34a",
			"#0891b2",
			"#4f46e5",
			"#ca8a04",
		],
	},
	dark: {
		background: "#0f172a",
		foreground: "#f8fafc",
		muted: "#94a3b8",
		grid: "#475569",
		section: "#1e293b",
		task: "#60a5fa",
		active: "#fbbf24",
		done: "#4ade80",
		critical: "#f87171",
		colors: [
			"#60a5fa",
			"#a78bfa",
			"#f472b6",
			"#fb923c",
			"#4ade80",
			"#22d3ee",
			"#818cf8",
			"#facc15",
		],
	},
};

function escapeXml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;")
		.replaceAll("'", "&apos;");
}

function number(value) {
	return Number(value.toFixed(3)).toString();
}

function sourceLines(code) {
	return code
		.replaceAll("\r\n", "\n")
		.split("\n")
		.map((line) => line.trimEnd())
		.filter((line) => !line.trimStart().startsWith("%%"));
}

function firstSourceLine(code) {
	return (
		sourceLines(code)
			.find((line) => line.trim())
			?.trim() ?? ""
	);
}

function prefixSvgIds(svg, prefix) {
	const ids = new Map();
	let result = svg.replace(/\bid=(['"])([^'"]+)\1/g, (_match, quote, id) => {
		const nextId = `${prefix}-${id.replace(/[^a-zA-Z0-9_.:-]/g, "-")}`;
		ids.set(id, nextId);
		return `id=${quote}${nextId}${quote}`;
	});

	for (const [id, nextId] of ids) {
		const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		result = result
			.replace(
				new RegExp(`url\\(\\s*#${escapedId}\\s*\\)`, "g"),
				`url(#${nextId})`,
			)
			.replace(
				new RegExp(`((?:href|xlink:href)=['"]#)${escapedId}(['"])`, "g"),
				`$1${nextId}$2`,
			);
	}

	return result;
}

function cleanLibrarySvg(svg, theme, seed) {
	const withoutRemoteFont = svg
		.replace(/^\s*@import\s+url\([^\n]+\);?\s*$/gim, "")
		.replace(/\bdataType=/g, "data-type=")
		.replace(
			/font-family:\s*['"]system-ui['"],\s*system-ui,\s*sans-serif/g,
			"font-family: system-ui, sans-serif",
		);
	const prefixed = prefixSvgIds(withoutRemoteFont, `${seed}-${theme}`);
	return prefixed.replace(
		/<svg\b/,
		`<svg id="${seed}-${theme}" data-mermaid-renderer="browserless"`,
	);
}

function renderSupportedDiagram(code, theme, seed) {
	const svg = renderMermaidSVG(code, THEME_OPTIONS[theme]);
	return cleanLibrarySvg(svg, theme, seed);
}

function parsePie(code) {
	const lines = sourceLines(code).filter((line) => line.trim());
	const header = lines.shift()?.trim() ?? "";
	if (!/^pie\b/i.test(header)) throw new Error("Invalid Mermaid pie header");

	const showData = /\bshowData\b/i.test(header);
	let title = header.match(/\btitle\s+(.+)$/i)?.[1]?.trim() ?? "Pie chart";
	const entries = [];

	for (const rawLine of lines) {
		const line = rawLine.trim();
		const titleMatch = line.match(/^title\s+(.+)$/i);
		if (titleMatch) {
			title = titleMatch[1].trim();
			continue;
		}
		const entry = line.match(
			/^(?:"((?:\\.|[^"])*)"|'((?:\\.|[^'])*)')\s*:\s*(-?(?:\d+(?:\.\d+)?|\.\d+))\s*$/,
		);
		if (!entry) throw new Error(`Unsupported Mermaid pie entry: ${line}`);
		const value = Number(entry[3]);
		if (!Number.isFinite(value) || value < 0) {
			throw new Error(`Invalid Mermaid pie value: ${entry[3]}`);
		}
		entries.push({ label: entry[1] ?? entry[2], value });
	}

	const total = entries.reduce((sum, entry) => sum + entry.value, 0);
	if (entries.length === 0 || total <= 0) {
		throw new Error("Mermaid pie chart requires at least one positive value");
	}
	return { entries, showData, title, total };
}

function renderPie(code, theme, seed) {
	const { entries, showData, title, total } = parsePie(code);
	const palette = CHART_PALETTES[theme];
	const width = 760;
	const height = Math.max(460, 100 + entries.length * 34);
	const centerX = 225;
	const centerY = Math.max(225, height / 2);
	const radius = 155;
	let angle = -Math.PI / 2;
	const slices = [];
	const legend = [];

	entries.forEach((entry, index) => {
		const color = palette.colors[index % palette.colors.length];
		const sweep = (entry.value / total) * Math.PI * 2;
		const endAngle = angle + sweep;
		if (entries.length === 1 || sweep >= Math.PI * 2 - 1e-8) {
			slices.push(
				`<circle cx="${centerX}" cy="${centerY}" r="${radius}" fill="${color}" stroke="${palette.background}" stroke-width="2"/>`,
			);
		} else if (sweep > 0) {
			const startX = centerX + radius * Math.cos(angle);
			const startY = centerY + radius * Math.sin(angle);
			const endX = centerX + radius * Math.cos(endAngle);
			const endY = centerY + radius * Math.sin(endAngle);
			const largeArc = sweep > Math.PI ? 1 : 0;
			slices.push(
				`<path d="M ${centerX} ${centerY} L ${number(startX)} ${number(startY)} A ${radius} ${radius} 0 ${largeArc} 1 ${number(endX)} ${number(endY)} Z" fill="${color}" stroke="${palette.background}" stroke-width="2"/>`,
			);
		}

		const percentage = `${number((entry.value / total) * 100)}%`;
		const valueLabel = showData ? `${entry.value} · ${percentage}` : percentage;
		const y = 116 + index * 34;
		legend.push(
			`<g><rect x="430" y="${y - 12}" width="18" height="18" rx="4" fill="${color}"/><text x="460" y="${y + 2}" fill="${palette.foreground}" font-size="15">${escapeXml(entry.label)}</text><text x="730" y="${y + 2}" fill="${palette.muted}" font-size="14" text-anchor="end">${escapeXml(valueLabel)}</text></g>`,
		);
		angle = endAngle;
	});

	return `<svg id="${seed}-${theme}" data-mermaid-renderer="browserless" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"><title>${escapeXml(title)}</title><text x="${width / 2}" y="35" fill="${palette.foreground}" font-family="system-ui, sans-serif" font-size="20" font-weight="600" text-anchor="middle">${escapeXml(title)}</text><g font-family="system-ui, sans-serif">${slices.join("")}${legend.join("")}</g></svg>`;
}

function parseDate(value) {
	const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
	if (!match) return null;
	const timestamp = Date.UTC(
		Number(match[1]),
		Number(match[2]) - 1,
		Number(match[3]),
	);
	const date = new Date(timestamp);
	if (
		date.getUTCFullYear() !== Number(match[1]) ||
		date.getUTCMonth() !== Number(match[2]) - 1 ||
		date.getUTCDate() !== Number(match[3])
	) {
		return null;
	}
	return timestamp;
}

function parseDuration(value) {
	const match = value.match(/^(\d+(?:\.\d+)?)\s*(d|w|h)$/i);
	if (!match) return null;
	const units = match[2].toLowerCase();
	const multiplier = units === "w" ? 7 : units === "h" ? 1 / 24 : 1;
	return Number(match[1]) * multiplier * DAY_MS;
}

function parseGantt(code) {
	const lines = sourceLines(code).filter((line) => line.trim());
	if (!/^gantt\b/i.test(lines.shift()?.trim() ?? "")) {
		throw new Error("Invalid Mermaid Gantt header");
	}

	let title = "Gantt chart";
	let section = "Tasks";
	const rows = [];
	const tasks = [];

	for (const rawLine of lines) {
		const line = rawLine.trim();
		const titleMatch = line.match(/^title\s+(.+)$/i);
		if (titleMatch) {
			title = titleMatch[1].trim();
			continue;
		}
		const sectionMatch = line.match(/^section\s+(.+)$/i);
		if (sectionMatch) {
			section = sectionMatch[1].trim();
			rows.push({ type: "section", label: section });
			continue;
		}
		if (
			/^(?:dateFormat|axisFormat|tickInterval|excludes|includes|todayMarker)\b/i.test(
				line,
			)
		) {
			continue;
		}

		const separator = line.indexOf(":");
		if (separator < 1)
			throw new Error(`Unsupported Mermaid Gantt row: ${line}`);
		const label = line.slice(0, separator).trim();
		const parts = line
			.slice(separator + 1)
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean);
		const flags = new Set();
		while (parts.length > 0 && GANTT_FLAGS.has(parts[0].toLowerCase())) {
			flags.add(parts.shift().toLowerCase());
		}

		let id;
		if (
			parts[0] &&
			!parseDate(parts[0]) &&
			!parseDuration(parts[0]) &&
			!/^after\s+/i.test(parts[0])
		) {
			id = parts.shift();
		}
		const task = {
			flags,
			id: id ?? `task-${tasks.length + 1}`,
			label,
			section,
			startSpec: parts.shift(),
			endSpec: parts.shift(),
		};
		tasks.push(task);
		rows.push({ type: "task", task });
	}

	if (tasks.length === 0) throw new Error("Mermaid Gantt chart has no tasks");
	const taskById = new Map(tasks.map((task) => [task.id, task]));
	const firstExplicitStart = tasks
		.map((task) => parseDate(task.startSpec ?? ""))
		.find((value) => value !== null);
	const baseDate = firstExplicitStart ?? Date.UTC(1970, 0, 1);

	function resolveTask(task, stack = new Set()) {
		if (task.start !== undefined) return task;
		if (stack.has(task))
			throw new Error(`Circular Mermaid Gantt dependency: ${task.id}`);
		stack.add(task);

		const index = tasks.indexOf(task);
		const previous = index > 0 ? resolveTask(tasks[index - 1], stack) : null;
		const explicitStart = parseDate(task.startSpec ?? "");
		const afterMatch = task.startSpec?.match(/^after\s+(.+)$/i);
		if (explicitStart !== null) {
			task.start = explicitStart;
		} else if (afterMatch) {
			const dependencies = afterMatch[1]
				.split(/\s+/)
				.map((id) => taskById.get(id))
				.filter(Boolean)
				.map((dependency) => resolveTask(dependency, stack).end);
			if (dependencies.length === 0) {
				throw new Error(`Unknown Mermaid Gantt dependency: ${afterMatch[1]}`);
			}
			task.start = Math.max(...dependencies);
		} else if (parseDuration(task.startSpec ?? "") !== null) {
			task.start = previous?.end ?? baseDate;
			task.endSpec = task.startSpec;
		} else {
			task.start = previous?.end ?? baseDate;
		}

		const explicitEnd = parseDate(task.endSpec ?? "");
		const duration = parseDuration(task.endSpec ?? "");
		if (explicitEnd !== null) task.end = Math.max(explicitEnd, task.start);
		else if (duration !== null) task.end = task.start + duration;
		else task.end = task.start + DAY_MS;
		if (task.flags.has("milestone")) task.end = task.start;
		stack.delete(task);
		return task;
	}

	for (const task of tasks) resolveTask(task);
	return { rows, tasks, title };
}

function formatDate(timestamp) {
	return new Date(timestamp).toISOString().slice(0, 10);
}

function renderGantt(code, theme, seed) {
	const { rows, tasks, title } = parseGantt(code);
	const palette = CHART_PALETTES[theme];
	const width = 1040;
	const left = 290;
	const right = 30;
	const plotWidth = width - left - right;
	const top = 82;
	const rowHeight = 38;
	const height = top + rows.length * rowHeight + 48;
	const minStart = Math.min(...tasks.map((task) => task.start));
	const maxEnd = Math.max(...tasks.map((task) => task.end));
	const range = Math.max(maxEnd - minStart, DAY_MS);
	const xFor = (timestamp) =>
		left + ((timestamp - minStart) / range) * plotWidth;
	const parts = [
		`<svg id="${seed}-${theme}" data-mermaid-renderer="browserless" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">`,
		`<title>${escapeXml(title)}</title>`,
		`<g font-family="system-ui, sans-serif"><text x="${width / 2}" y="30" fill="${palette.foreground}" font-size="20" font-weight="600" text-anchor="middle">${escapeXml(title)}</text>`,
	];

	const tickCount = 5;
	for (let index = 0; index <= tickCount; index += 1) {
		const timestamp = minStart + (range * index) / tickCount;
		const x = xFor(timestamp);
		parts.push(
			`<line x1="${number(x)}" y1="58" x2="${number(x)}" y2="${height - 24}" stroke="${palette.grid}" stroke-width="1" opacity="0.55"/>`,
			`<text x="${number(x)}" y="52" fill="${palette.muted}" font-size="12" text-anchor="middle">${formatDate(timestamp)}</text>`,
		);
	}

	rows.forEach((row, index) => {
		const y = top + index * rowHeight;
		if (row.type === "section") {
			parts.push(
				`<rect x="12" y="${y}" width="${width - 24}" height="${rowHeight - 4}" rx="5" fill="${palette.section}"/>`,
				`<text x="24" y="${y + 23}" fill="${palette.foreground}" font-size="14" font-weight="600">${escapeXml(row.label)}</text>`,
			);
			return;
		}

		const { task } = row;
		const startX = xFor(task.start);
		const endX = xFor(task.end);
		const barY = y + 7;
		const color = task.flags.has("crit")
			? palette.critical
			: task.flags.has("done")
				? palette.done
				: task.flags.has("active")
					? palette.active
					: palette.task;
		parts.push(
			`<text x="${left - 14}" y="${y + 22}" fill="${palette.foreground}" font-size="13" text-anchor="end">${escapeXml(task.label)}</text>`,
		);
		if (task.flags.has("milestone") || task.end === task.start) {
			const centerY = barY + 12;
			parts.push(
				`<polygon points="${number(startX)},${centerY - 10} ${number(startX + 10)},${centerY} ${number(startX)},${centerY + 10} ${number(startX - 10)},${centerY}" fill="${color}"/>`,
			);
		} else {
			parts.push(
				`<rect x="${number(startX)}" y="${barY}" width="${number(Math.max(endX - startX, 3))}" height="24" rx="5" fill="${color}"/>`,
			);
		}
	});

	parts.push("</g></svg>");
	return parts.join("");
}

export function renderBrowserlessMermaid(code, theme, seed) {
	if (!(theme in THEME_OPTIONS))
		throw new Error(`Unknown Mermaid theme: ${theme}`);
	const header = firstSourceLine(code);
	if (/^gantt\b/i.test(header)) return renderGantt(code, theme, seed);
	if (/^pie\b/i.test(header)) return renderPie(code, theme, seed);
	return renderSupportedDiagram(code, theme, seed);
}
