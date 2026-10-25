import * as React from 'react';
import * as AccordionPrimitive from '@radix-ui/react-accordion';

import { cn } from '@/lib/utils';
import { ChevronRightIcon } from '@/components/icons/ui3';

function Accordion({ ...props }: React.ComponentProps<typeof AccordionPrimitive.Root>) {
	return <AccordionPrimitive.Root data-slot="accordion" {...props} />;
}

function AccordionItem({
	className,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Item>) {
	return (
		<AccordionPrimitive.Item
			data-slot="accordion-item"
			className={cn('border-b last:border-b-0', className)}
			{...props}
		/>
	);
}

// Styled like a UI3 layers-panel row: 32px tall, chevron on the left, instant expand.
function AccordionTrigger({
	className,
	children,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Trigger>) {
	return (
		<AccordionPrimitive.Header className="flex">
			<AccordionPrimitive.Trigger
				data-slot="accordion-trigger"
				className={cn(
					'AccordionTrigger flex h-8 flex-1 items-center gap-0 text-left text-body-medium font-strong outline-none hover:bg-hover focus-visible:outline-1 focus-visible:outline-border-selected focus-visible:-outline-offset-1 disabled:pointer-events-none disabled:text-subtle',
					className,
				)}
				{...props}
			>
				<ChevronRightIcon className="AccordionChevron text-icon-secondary pointer-events-none size-6 shrink-0" />
				{children}
			</AccordionPrimitive.Trigger>
		</AccordionPrimitive.Header>
	);
}

function AccordionContent({
	className,
	children,
	...props
}: React.ComponentProps<typeof AccordionPrimitive.Content>) {
	return (
		<AccordionPrimitive.Content
			data-slot="accordion-content"
			className="overflow-hidden text-body-medium"
			{...props}
		>
			<div className={cn('pb-2', className)}>{children}</div>
		</AccordionPrimitive.Content>
	);
}

export { Accordion, AccordionItem, AccordionTrigger, AccordionContent };
