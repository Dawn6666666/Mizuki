/**
 * MobileTOC 自定义钩子
 * 处理移动端目录的状态管理和交互逻辑
 */

import {
	getTOCBadge,
	normalizeTOCBadgeStyle,
	type TOCBadgeStyle,
} from "../utils/japanese-katakana";

export interface TOCItem {
	id: string;
	text: string;
	level: number;
	badge?: string;
}

export interface PostItem {
	title: string;
	url: string;
	category?: string;
	pinned?: boolean;
}

export interface TOCConfig {
	badgeStyle: TOCBadgeStyle;
	depth: number;
}

/**
 * 生成目录项
 */
export function generateTOCItems(config: TOCConfig): TOCItem[] {
	const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
	const items: TOCItem[] = [];
	let h1Count = 0;

	headings.forEach((heading) => {
		if (!heading.id) {
			return;
		}

		const level = parseInt(heading.tagName.charAt(1), 10);

		// 根据 depth 配置过滤标题
		if (level > config.depth) {
			return;
		}

		const text = (heading.textContent || "").replace(/#+\s*$/, "");
		let badge = "";

		// 只为 H1 标题生成 badge
		if (level === 1) {
			badge = getTOCBadge(h1Count, config.badgeStyle);
			h1Count++;
		}

		items.push({ id: heading.id, text, level, badge });
	});

	return items;
}

/**
 * 生成文章列表项（首页使用）
 */
export function generatePostItems(): PostItem[] {
	const postCards = document.querySelectorAll(".card-base");
	const items: PostItem[] = [];

	postCards.forEach((card) => {
		const titleLink = card.querySelector(
			'a[href*="/posts/"].transition.group',
		);
		const categoryLink = card.querySelector(
			'a[href*="/categories/"].link-lg',
		);
		const pinnedIcon = titleLink?.querySelector('svg[data-icon="mdi:pin"]');

		if (titleLink) {
			const href = titleLink.getAttribute("href");
			const title =
				titleLink.textContent?.replace(/\s+/g, " ").trim() || "";
			const category = categoryLink?.textContent?.trim() || "";
			const pinned = !!pinnedIcon;

			if (href && title) {
				items.push({ title, url: href, category, pinned });
			}
		}
	});

	return items;
}

/**
 * 检查是否为首页
 */
export function checkIsHomePage(): boolean {
	const pathname = window.location.pathname;
	return pathname === "/" || pathname === "" || /^\/\d+\/?$/.test(pathname);
}

/**
 * 更新活动标题（基于滚动位置）
 */
export function updateActiveHeading(): string {
	const headings = document.querySelectorAll("h1, h2, h3, h4, h5, h6");
	const scrollTop = window.scrollY;
	const offset = 100;

	let currentActiveId = "";
	headings.forEach((heading) => {
		if (heading.id) {
			const elementTop = (heading as HTMLElement).offsetTop - offset;
			if (scrollTop >= elementTop) {
				currentActiveId = heading.id;
			}
		}
	});

	return currentActiveId;
}

/**
 * 滚动到指定标题
 */
export function scrollToHeading(id: string, offset = 80): void {
	const element = document.getElementById(id);
	if (element) {
		const elementPosition = element.offsetTop - offset;
		window.scrollTo({
			top: elementPosition,
			behavior: "smooth",
		});
	}
}

/**
 * 获取 TOC 配置
 */
export function getTOCConfig(): TOCConfig {
	const badgeStyle = normalizeTOCBadgeStyle(
		window.siteConfig?.toc?.badgeStyle,
		window.siteConfig?.toc?.useJapaneseBadge,
	);
	return {
		badgeStyle,
		depth: window.siteConfig?.toc?.depth ?? 3,
	};
}
