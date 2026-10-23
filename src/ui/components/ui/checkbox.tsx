import * as React from 'react';

import { cn } from '@/lib/utils';

// UI3 "Checkbox": 16px box with 5px corners. A real checkbox input sits invisibly on top, so
// clicks, keyboard and screen readers behave natively; the box below is drawn from its state.
function Checkbox({ className, ...props }: Omit<React.ComponentProps<'input'>, 'type'>) {
	return (
		<span className={cn('relative inline-flex size-4 shrink-0', className)}>
			<input
				type="checkbox"
				data-slot="checkbox"
				className="peer absolute inset-0 m-0 size-full opacity-0 disabled:pointer-events-none"
				{...props}
			/>
			<span
				aria-hidden="true"
				className="pointer-events-none size-4 rounded-md border border-border-translucent bg-secondary peer-checked:border-border-selected-strong peer-checked:bg-primary peer-focus-visible:border-border-selected-strong peer-[:disabled:not(:checked)]:border-border peer-[:disabled:not(:checked)]:bg-transparent peer-[:checked:disabled]:border-transparent peer-[:checked:disabled]:bg-disabled"
			/>
			{/* icon.16.check */}
			<svg
				aria-hidden="true"
				viewBox="0 0 16 16"
				fill="currentColor"
				className="pointer-events-none absolute inset-0 hidden size-4 text-primary-foreground peer-checked:block"
			>
				<path d="M11.0841 4.22265C11.2372 3.99289 11.5477 3.9308 11.7774 4.08398C12.0072 4.23715 12.0693 4.54757 11.9161 4.77734L7.9161 10.7773C7.833 10.902 7.69798 10.9833 7.54891 10.998C7.4 11.0126 7.25237 10.9593 7.14656 10.8535L4.14656 7.85351C3.9513 7.65825 3.9513 7.34174 4.14656 7.14648C4.34183 6.95122 4.65833 6.95122 4.8536 7.14648L7.42196 9.71484L11.0841 4.22265Z" />
			</svg>
		</span>
	);
}

export { Checkbox };
