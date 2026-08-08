export interface MarkdownEnhancementConfig {
	mermaid: {
		errorMode: "warn" | "error";
	};
	autoImageGrid: {
		enable: boolean;
		minImages: number;
		maxColumns: number;
	};
	wikiLink: {
		enable: boolean;
	};
	plantuml: {
		enable: boolean;
		server: string;
		lightTheme: string;
		darkTheme: string;
	};
}

/**
 * Markdown 增强配置。修改后需要重启 Astro 开发服务器。
 *
 * PlantUML 源码会编码进 URL 并交给配置的服务器渲染；私有内容可关闭该
 * 功能或改用自托管服务器。
 */
export const markdownConfig: MarkdownEnhancementConfig = {
	mermaid: {
		// warn 会保留源码降级；error 会让无效 Mermaid 语法中止构建。
		errorMode: "warn",
	},
	autoImageGrid: {
		enable: true,
		minImages: 2,
		maxColumns: 4,
	},
	wikiLink: {
		enable: true,
	},
	plantuml: {
		enable: true,
		server: "https://www.plantuml.com/plantuml",
		lightTheme: "",
		darkTheme: "cyborg",
	},
};
