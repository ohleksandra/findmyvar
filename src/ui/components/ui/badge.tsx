import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

// UI3 "Badge small": 16px tall, 4px side padding, 5px corners, body.medium text.
const badgeVariants = cva(
	'inline-flex items-center justify-center rounded-md h-4 px-1 text-body-medium font-default w-fit whitespace-nowrap shrink-0 [&>svg]:size-4 gap-0.5 [&>svg]:pointer-events-none outline-none focus-visible:outline-1 focus-visible:outline-border-selected overflow-hidden',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground',
				secondary: 'bg-secondary text-foreground',
				destructive: 'bg-destructive text-primary-foreground',
				outline: 'border border-border-translucent text-foreground',
				selected: 'bg-selected text-foreground',
				// The ring keeps it visible on a highlighted (bg-selected) menu row.
				new: 'bg-selected text-brand-text ring-1 ring-inset ring-brand-text/20',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	},
);

function Badge({
	className,
	variant,
	asChild = false,
	...props
}: React.ComponentProps<'span'> & VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
	const Comp = asChild ? Slot : 'span';

	return (
		<Comp data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

export { Badge, badgeVariants };
