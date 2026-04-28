/**
 * TOC 徽章字符集
 * 用于 TOC 徽章显示，支持多种计数方式
 */

/**
 * 日语片假名字符集（46 个字符）
 * 按五十音图顺序排列
 */
export const JAPANESE_KATAKANA = [
	// あ行
	"ア",
	"イ",
	"ウ",
	"エ",
	"オ",
	// か行
	"カ",
	"キ",
	"ク",
	"ケ",
	"コ",
	// さ行
	"サ",
	"シ",
	"ス",
	"セ",
	"ソ",
	// た行
	"タ",
	"チ",
	"ツ",
	"テ",
	"ト",
	// な行
	"ナ",
	"ニ",
	"ヌ",
	"ネ",
	"ノ",
	// は行
	"ハ",
	"ヒ",
	"フ",
	"ヘ",
	"ホ",
	// ま行
	"マ",
	"ミ",
	"ム",
	"メ",
	"モ",
	// や行
	"ヤ",
	"ユ",
	"ヨ",
	// ら行
	"ラ",
	"リ",
	"ル",
	"レ",
	"ロ",
	// わ行
	"ワ",
	"ヲ",
	"ン",
] as const;

/**
 * 罗马数字字符集（12 个）
 * 固定宽度徽章只适合单个罗马数字字符，超过 12 后回退为数字。
 */
export const ROMAN_NUMERALS = [
	"Ⅰ",
	"Ⅱ",
	"Ⅲ",
	"Ⅳ",
	"Ⅴ",
	"Ⅵ",
	"Ⅶ",
	"Ⅷ",
	"Ⅸ",
	"Ⅹ",
	"Ⅺ",
	"Ⅻ",
] as const;

export type TOCBadgeStyle = "number" | "katakana" | "roman";

export type JapaneseKatakanaChar = (typeof JAPANESE_KATAKANA)[number];

/**
 * 规范化运行时传入的 TOC 徽章样式。
 * @param value - 可能来自全局配置或 data-* 属性的运行时值
 * @param useJapaneseBadge - 旧版布尔配置的兼容回退
 * @returns 有效的徽章样式
 */
export function normalizeTOCBadgeStyle(
	value: unknown,
	useJapaneseBadge?: boolean,
): TOCBadgeStyle {
	if (value === "number" || value === "katakana" || value === "roman") {
		return value;
	}
	return useJapaneseBadge ? "katakana" : "number";
}

/**
 * 根据 badgeStyle 获取 TOC 徽章文本
 * @param index - 索引（从 0 开始）
 * @param badgeStyle - 徽章样式："number" | "katakana" | "roman"
 * @returns 徽章文本
 */
export function getTOCBadge(index: number, badgeStyle: TOCBadgeStyle): string {
	switch (badgeStyle) {
		case "katakana":
			if (index < JAPANESE_KATAKANA.length) {
				return JAPANESE_KATAKANA[index];
			}
			return (index + 1).toString();
		case "roman":
			if (index < ROMAN_NUMERALS.length) {
				return ROMAN_NUMERALS[index];
			}
			return (index + 1).toString();
		case "number":
		default:
			return (index + 1).toString();
	}
}

/**
 * 兼容旧接口：根据 useJapanese 布尔值获取徽章
 * @deprecated 请使用 getTOCBadge(index, badgeStyle) 代替
 */
export function getKatakanaBadge(index: number, useJapanese: boolean): string {
	return getTOCBadge(index, useJapanese ? "katakana" : "number");
}

/**
 * 获取可用的日语字符数量
 */
export const KATAKANA_COUNT = JAPANESE_KATAKANA.length;
