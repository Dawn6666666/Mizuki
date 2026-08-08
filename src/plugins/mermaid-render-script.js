(() => {
	if (window.mermaidInteractionsInitialized) return;
	window.mermaidInteractionsInitialized = true;

	const MIN_SCALE = 0.2;
	const MAX_SCALE = 6;
	const ZOOM_STEP = 1.2;

	let fullscreenSession = null;
	let themeObserver = null;
	const diagramControllers = new WeakMap();

	function getThemePalette() {
		const root = document.documentElement;
		const isDark = root.classList.contains("dark");
		const styles = getComputedStyle(root);
		const surface =
			styles.getPropertyValue("--card-bg").trim() ||
			styles.getPropertyValue("--surface").trim() ||
			(isDark ? "#0b1220" : "#ffffff");
		return {
			surface,
			backdrop: isDark ? "rgba(8, 15, 30, 0.9)" : "rgba(255, 255, 255, 0.94)",
			border: isDark ? "rgba(255, 255, 255, 0.08)" : "rgba(15, 23, 42, 0.08)",
		};
	}

	function getActiveSvg(host) {
		const theme = document.documentElement.classList.contains("dark")
			? "dark"
			: "light";
		return (
			host.querySelector(`.mermaid-svg--${theme}`) || host.querySelector("svg")
		);
	}

	function createControlButton(action, signal) {
		const button = document.createElement("button");
		button.type = "button";
		button.className = "mermaid-control";
		button.dataset.action = action.name;
		button.textContent = action.label;
		button.title = action.title;
		button.setAttribute("aria-label", action.title);
		button.addEventListener(
			"click",
			(event) => {
				event.preventDefault();
				event.stopPropagation();
				action.run();
			},
			{ signal },
		);
		return button;
	}

	function disposeDiagramInteraction(host) {
		diagramControllers.get(host)?.destroy();
	}

	function attachDiagramInteraction(host, diagramElement, options = {}) {
		disposeDiagramInteraction(host);
		const eventController = new AbortController();
		const { signal } = eventController;
		const viewport = document.createElement("div");
		viewport.className = "mermaid-viewport";
		const wrapper = document.createElement("div");
		wrapper.className = "mermaid-zoom-wrapper";
		wrapper.appendChild(diagramElement);
		viewport.appendChild(wrapper);

		const controls = document.createElement("div");
		controls.className = "mermaid-zoom-controls";
		controls.setAttribute("role", "toolbar");
		controls.setAttribute("aria-label", "Mermaid diagram controls");

		const state = { scale: 1, x: 0, y: 0 };
		let isPanning = false;
		let startClientX = 0;
		let startClientY = 0;
		let startX = 0;
		let startY = 0;

		function applyTransform() {
			wrapper.style.transform = `translate3d(${state.x}px, ${state.y}px, 0) scale(${state.scale})`;
		}

		function setScale(nextScale, clientPoint) {
			const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
			if (scale === state.scale) return;
			const rect = viewport.getBoundingClientRect();
			const anchorX = clientPoint
				? clientPoint.clientX - rect.left
				: rect.width / 2;
			const anchorY = clientPoint
				? clientPoint.clientY - rect.top
				: rect.height / 2;
			const diagramX = (anchorX - state.x) / state.scale;
			const diagramY = (anchorY - state.y) / state.scale;
			state.scale = +scale.toFixed(3);
			state.x = anchorX - diagramX * state.scale;
			state.y = anchorY - diagramY * state.scale;
			applyTransform();
		}

		function resetView() {
			state.scale = 1;
			state.x = 0;
			state.y = 0;
			applyTransform();
		}

		const actions = [
			{
				name: "zoom-in",
				label: "+",
				title: "Zoom in",
				run: () => setScale(state.scale * ZOOM_STEP),
			},
			{
				name: "zoom-out",
				label: "−",
				title: "Zoom out",
				run: () => setScale(state.scale / ZOOM_STEP),
			},
			{
				name: "reset",
				label: "⤾",
				title: "Reset view",
				run: resetView,
			},
		];
		if (typeof options.onFullscreen === "function") {
			actions.push({
				name: "fullscreen",
				label: "⛶",
				title: "View fullscreen",
				run: options.onFullscreen,
			});
		}
		for (const action of actions) {
			controls.appendChild(createControlButton(action, signal));
		}
		host.replaceChildren(viewport, controls);

		viewport.addEventListener(
			"pointerdown",
			(event) => {
				if (!event.isPrimary) return;
				if (event.pointerType === "mouse" && event.button !== 0) return;
				event.preventDefault();
				isPanning = true;
				startClientX = event.clientX;
				startClientY = event.clientY;
				startX = state.x;
				startY = state.y;
				viewport.classList.add("is-panning");
				viewport.setPointerCapture(event.pointerId);
			},
			{ signal },
		);
		viewport.addEventListener(
			"pointermove",
			(event) => {
				if (!isPanning) return;
				state.x = startX + event.clientX - startClientX;
				state.y = startY + event.clientY - startClientY;
				applyTransform();
			},
			{ signal },
		);
		function endPan(event) {
			if (!isPanning) return;
			isPanning = false;
			viewport.classList.remove("is-panning");
			if (event && viewport.hasPointerCapture(event.pointerId)) {
				viewport.releasePointerCapture(event.pointerId);
			}
		}
		viewport.addEventListener("pointerup", endPan, { signal });
		viewport.addEventListener("pointercancel", endPan, { signal });
		viewport.addEventListener(
			"lostpointercapture",
			() => {
				isPanning = false;
				viewport.classList.remove("is-panning");
			},
			{ signal },
		);
		viewport.addEventListener(
			"wheel",
			(event) => {
				event.preventDefault();
				setScale(state.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12), event);
			},
			{ passive: false, signal },
		);
		viewport.addEventListener("dblclick", resetView, { signal });
		applyTransform();

		const controller = {
			destroy() {
				eventController.abort();
				diagramControllers.delete(host);
			},
		};
		diagramControllers.set(host, controller);
		return controller;
	}

	function closeFullscreen() {
		if (!fullscreenSession) return;
		const session = fullscreenSession;
		fullscreenSession = null;
		session.eventController.abort();
		session.diagramController.destroy();
		session.overlay.remove();
		document.body.classList.remove("mermaid-fullscreen-open");
		if (session.previousFocus?.isConnected) {
			session.previousFocus.focus({ preventScroll: true });
		}
	}

	function openFullscreen(sourceHost) {
		const sourceSvg = getActiveSvg(sourceHost);
		if (!sourceSvg) return;
		closeFullscreen();
		const palette = getThemePalette();
		const previousFocus =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
		const eventController = new AbortController();
		const { signal } = eventController;
		const overlay = document.createElement("div");
		overlay.className = "mermaid-fullscreen-overlay";
		overlay.setAttribute("role", "dialog");
		overlay.setAttribute("aria-modal", "true");
		overlay.setAttribute("aria-label", "Fullscreen Mermaid diagram");
		overlay.style.setProperty("--mermaid-fs-backdrop", palette.backdrop);
		overlay.style.setProperty("--mermaid-fs-surface", palette.surface);
		overlay.style.setProperty("--mermaid-fs-border", palette.border);

		const stage = document.createElement("div");
		stage.className = "mermaid-fullscreen-stage";
		const clonedSvg = sourceSvg.cloneNode(true);
		clonedSvg.removeAttribute("width");
		clonedSvg.removeAttribute("height");
		clonedSvg.style.width = "100%";
		clonedSvg.style.height = "100%";
		clonedSvg.style.maxWidth = "100%";
		clonedSvg.style.maxHeight = "100%";
		const diagramController = attachDiagramInteraction(stage, clonedSvg);

		const closeButton = document.createElement("button");
		closeButton.type = "button";
		closeButton.className = "mermaid-fullscreen-close";
		closeButton.textContent = "×";
		closeButton.title = "Close fullscreen";
		closeButton.setAttribute("aria-label", "Close fullscreen diagram");
		closeButton.addEventListener("click", closeFullscreen, { signal });
		stage.appendChild(closeButton);
		overlay.appendChild(stage);
		overlay.addEventListener(
			"click",
			(event) => {
				if (event.target === overlay) closeFullscreen();
			},
			{ signal },
		);
		document.addEventListener(
			"keydown",
			(event) => {
				if (event.key === "Escape") {
					event.preventDefault();
					closeFullscreen();
					return;
				}
				if (event.key !== "Tab") return;
				const focusable = Array.from(
					overlay.querySelectorAll("button:not([disabled])"),
				);
				if (focusable.length === 0) return;
				const first = focusable[0];
				const last = focusable[focusable.length - 1];
				if (event.shiftKey && document.activeElement === first) {
					event.preventDefault();
					last.focus();
				} else if (!event.shiftKey && document.activeElement === last) {
					event.preventDefault();
					first.focus();
				}
			},
			{ signal },
		);

		fullscreenSession = {
			overlay,
			eventController,
			diagramController,
			previousFocus,
		};
		document.body.appendChild(overlay);
		document.body.classList.add("mermaid-fullscreen-open");
		closeButton.focus({ preventScroll: true });
	}

	function enhanceMermaidDiagrams() {
		const hosts = Array.from(
			document.querySelectorAll(".mermaid[data-mermaid-static]"),
		);
		if (hosts.length === 0) return;
		window.dispatchEvent(new CustomEvent("mermaid:render:start"));
		for (const host of hosts) {
			if (host.dataset.mermaidEnhanced === "true") continue;
			const variants = host.querySelector(".mermaid-static-variants");
			if (!variants) continue;
			host.dataset.mermaidEnhanced = "true";
			attachDiagramInteraction(host, variants, {
				onFullscreen: () => openFullscreen(host),
			});
		}
		window.dispatchEvent(
			new CustomEvent("mermaid:render:done", {
				detail: { count: hosts.length },
			}),
		);
	}

	function setupThemeObserver() {
		themeObserver?.disconnect();
		themeObserver = new MutationObserver((mutations) => {
			if (mutations.some((mutation) => mutation.attributeName === "class")) {
				closeFullscreen();
			}
		});
		themeObserver.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});
	}

	function initialize() {
		setupThemeObserver();
		enhanceMermaidDiagrams();
		window.renderMermaidDiagrams = enhanceMermaidDiagrams;
		document.addEventListener("astro:page-load", enhanceMermaidDiagrams);
		document.addEventListener("astro:before-swap", () => {
			closeFullscreen();
			themeObserver?.disconnect();
		});
		document.addEventListener("astro:after-swap", () => {
			setupThemeObserver();
			enhanceMermaidDiagrams();
		});
	}

	if (document.readyState === "loading") {
		document.addEventListener("DOMContentLoaded", initialize, { once: true });
	} else {
		initialize();
	}
})();
