'use client';

import * as React from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { SearchSmallIcon } from '@/components/icons/ui3';

import { cn } from '@/lib/utils';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
	return (
		<CommandPrimitive
			data-slot="command"
			className={cn(
				'bg-popover text-popover-foreground flex h-full w-full flex-col overflow-hidden rounded-md',
				className,
			)}
			{...props}
		/>
	);
}

function CommandDialog({
	title = 'Command Palette',
	description = 'Search for a command to run...',
	children,
	className,
	showCloseButton = true,
	...props
}: React.ComponentProps<typeof Dialog> & {
	title?: string;
	description?: string;
	className?: string;
	showCloseButton?: boolean;
}) {
	return (
		<Dialog {...props}>
			<DialogHeader className="sr-only">
				<DialogTitle>{title}</DialogTitle>
				<DialogDescription>{description}</DialogDescription>
			</DialogHeader>
			<DialogContent
				className={cn('overflow-hidden p-0', className)}
				showCloseButton={showCloseButton}
			>
				<Command className="[&_[cmdk-group-heading]]:text-muted-foreground **:data-[slot=command-input-wrapper]:h-12 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 [&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 [&_[cmdk-input]]:h-12 [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-3 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5">
					{children}
				</Command>
			</DialogContent>
		</Dialog>
	);
}

function CommandInput({
	className,
	wrapperClassName,
	startAdornment,
	shortcut = 'Search ↵',
	...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
	wrapperClassName?: string;
	startAdornment?: React.ReactNode;
	shortcut?: React.ReactNode;
}) {
	return (
		// UI3 "Text input" (Large, icon lead): filled bg-secondary, blue border only on focus.
		<div
			data-slot="command-input-wrapper"
			className={cn(
				'flex h-8 items-center rounded-md border border-transparent bg-secondary pr-2 focus-within:border-border-selected',
				wrapperClassName,
			)}
		>
			<SearchSmallIcon className="size-6 shrink-0 text-icon-secondary" />
			{startAdornment}
			<CommandPrimitive.Input
				data-slot="command-input"
				className={cn(
					'placeholder:text-subtle flex h-full w-full min-w-0 bg-transparent text-body-medium outline-hidden disabled:text-subtle',
					className,
				)}
				{...props}
			/>
			{shortcut && <CommandShortcut className="text-nowrap">{shortcut}</CommandShortcut>}
		</div>
	);
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
	return (
		<CommandPrimitive.List
			data-slot="command-list"
			className={cn(
				// Light UI3 panel that follows the theme, like Figma's variable and font pickers.
				'bg-popover text-popover-foreground shadow-menu max-h-[300px] scroll-py-2 overflow-x-hidden overflow-y-auto rounded-xl py-2',
				className,
			)}
			{...props}
		/>
	);
}

function CommandEmpty({ ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
	return (
		<CommandPrimitive.Empty
			data-slot="command-empty"
			className="text-muted-foreground px-4 py-1 text-body-medium"
			{...props}
		/>
	);
}

function CommandGroup({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Group>) {
	return (
		<CommandPrimitive.Group
			data-slot="command-group"
			className={cn(
				'[&_[cmdk-group-heading]]:text-muted-foreground overflow-hidden px-2 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-body-medium',
				className,
			)}
			{...props}
		/>
	);
}

function CommandSeparator({
	className,
	...props
}: React.ComponentProps<typeof CommandPrimitive.Separator>) {
	return (
		<CommandPrimitive.Separator
			data-slot="command-separator"
			className={cn('bg-border my-2 h-px', className)}
			{...props}
		/>
	);
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
	return (
		<CommandPrimitive.Item
			data-slot="command-item"
			className={cn(
				// 24px rows inset 8px; the active row gets the pale selection blue Figma uses in pickers.
				"data-[selected=true]:bg-selected [&_svg]:text-icon relative flex min-h-6 cursor-default items-center gap-1 rounded-md px-2 text-body-medium outline-hidden select-none data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
				className,
			)}
			{...props}
		/>
	);
}

function CommandShortcut({ className, ...props }: React.ComponentProps<'span'>) {
	return (
		<span
			data-slot="command-shortcut"
			className={cn('text-subtle ml-auto text-body-medium', className)}
			{...props}
		/>
	);
}

export {
	Command,
	CommandDialog,
	CommandInput,
	CommandList,
	CommandEmpty,
	CommandGroup,
	CommandItem,
	CommandShortcut,
	CommandSeparator,
};
