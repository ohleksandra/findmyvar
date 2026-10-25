import * as React from 'react';
import * as TabsPrimitive from '@radix-ui/react-tabs';

import { cn } from '@/lib/utils';

function Tabs({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Root>) {
	return (
		<TabsPrimitive.Root
			data-slot="tabs"
			className={cn('flex flex-col gap-2', className)}
			{...props}
		/>
	);
}

// UI3 "Tabs": no track, 4px gap between tabs.
function TabsList({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.List>) {
	return (
		<TabsPrimitive.List
			data-slot="tabs-list"
			className={cn('inline-flex w-fit items-center gap-1', className)}
			{...props}
		/>
	);
}

// UI3 "_Tab": selected tabs get bg-secondary and strong text, the rest stay secondary.
function TabsTrigger({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
	return (
		<TabsPrimitive.Trigger
			data-slot="tabs-trigger"
			className={cn(
				"inline-flex h-6 items-center justify-center gap-1 rounded-md px-2 text-body-medium font-default text-muted-foreground whitespace-nowrap outline-none hover:text-foreground focus-visible:outline-1 focus-visible:outline-border-selected focus-visible:-outline-offset-1 data-[state=active]:bg-secondary data-[state=active]:font-strong data-[state=active]:text-foreground disabled:pointer-events-none disabled:text-subtle [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

function TabsContent({ className, ...props }: React.ComponentProps<typeof TabsPrimitive.Content>) {
	return (
		<TabsPrimitive.Content
			data-slot="tabs-content"
			className={cn('flex-1 outline-none', className)}
			{...props}
		/>
	);
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
