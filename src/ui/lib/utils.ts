import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// Teach tailwind-merge the UI3 type scale and weights from styles.css; otherwise it reads
// `text-body-medium` as a color and drops the real text color next to it.
const twMerge = extendTailwindMerge({
	extend: {
		theme: {
			text: [
				'body-small',
				'body-medium',
				'body-large',
				'heading-small',
				'heading-medium',
				'heading-large',
			],
			'font-weight': ['default', 'strong'],
		},
	},
});

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs));
}
