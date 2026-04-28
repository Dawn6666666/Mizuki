/**
 * TOC 组件共享类型定义
 */

/**
 * TOC 条目数据结构
 */
export interface TOCItem {
	/** 标题 ID（用于锚点） */
	id: string;
	/** 标题文本 */
	text: string;
	/** 标题级别（1-6） */
	level: number;
	/** 相对深度（0 = 顶级） */
	depth: number;
	/** 徽章文本（数字、日语片假名或罗马数字） */
	badge?: string;
}

/**
 * TOC 配置
 */
export interface TOCConfig {
	/** 是否启用 TOC */
	enable: boolean;
	/** 显示模式 */
	mode: "float" | "sidebar";
	/** 标题深度（1-6） */
	depth: number;
	/** 徽章样式 */
	badgeStyle: "number" | "katakana" | "roman";
	/** @deprecated 使用 badgeStyle 代替 */
	useJapaneseBadge: boolean;
}

/**
 * 从 DOM 提取的标题数据
 */
export interface HeadingData {
	/** 标题 ID */
	id: string;
	/** 标题文本 */
	text: string;
	/** 标题级别（1-6） */
	level: number;
}

/**
 * TOC 组件 Props 基础接口
 */
export interface TOCBaseProps {
	/** 自定义类名 */
	class?: string;
}
