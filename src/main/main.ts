export default function () {
	const screenWidth = figma.viewport.bounds.width;
	const pluginwidth = Math.max(900, Math.floor(screenWidth * 0.4));

	figma.showUI(__html__, { width: pluginwidth, height: 600, themeColors: true });
}
