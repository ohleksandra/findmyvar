import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// UI3 "Button" and "Button icon": 24px tall, 8px side padding, 5px corners, body.medium text.
// Bordered buttons darken on hover with an inset overlay rather than a new background, so the
// hover still shows on buttons that set their own fill (e.g. white buttons on a grey panel).
const HOVER_OVERLAY = 'hover:shadow-[inset_0_0_0_100px_var(--color-hover-translucent)]';

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-1 whitespace-nowrap rounded-md text-body-medium font-default disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-6 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:outline-1 focus-visible:outline-border-selected focus-visible:-outline-offset-1",
	{
		variants: {
			variant: {
				default:
					'bg-primary text-primary-foreground hover:bg-brand-hover active:bg-brand-hover disabled:bg-disabled',
				destructive:
					'bg-destructive text-primary-foreground hover:bg-danger-hover active:bg-danger-hover disabled:bg-disabled',
				outline: `border border-border-translucent text-foreground active:bg-hover-translucent disabled:text-subtle ${HOVER_OVERLAY}`,
				secondary: `border border-border-translucent text-foreground active:bg-hover-translucent disabled:text-subtle ${HOVER_OVERLAY}`,
				ghost: 'text-icon hover:bg-hover-translucent disabled:text-icon-tertiary',
				link: 'text-brand-text hover:underline',
			},
			size: {
				default: 'h-6 px-2 has-[>svg]:pl-0',
				sm: 'h-6 px-2 has-[>svg]:pl-0',
				lg: 'h-8 px-3 rounded-md has-[>svg]:pl-1',
				icon: 'size-6',
				'icon-sm': 'size-6',
				'icon-lg': 'size-8',
			},
		},
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	},
);

function Button({
	className,
	variant,
	size,
	asChild = false,
	...props
}: React.ComponentProps<'button'> &
	VariantProps<typeof buttonVariants> & {
		asChild?: boolean;
	}) {
	const Comp = asChild ? Slot : 'button';

	return (
		<Comp
			data-slot="button"
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
