// The Figma plugin iframe often blocks navigator.clipboard, so fall back to execCommand.
export async function copyToClipboard(text: string): Promise<boolean> {
	try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		const textarea = document.createElement('textarea');
		textarea.value = text;
		textarea.setAttribute('readonly', '');
		textarea.style.position = 'absolute';
		textarea.style.left = '-9999px';
		document.body.appendChild(textarea);
		textarea.select();
		const copied = document.execCommand('copy');
		document.body.removeChild(textarea);
		return copied;
	}
}
