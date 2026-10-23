import { LoadingSmallIcon } from '@/components/icons/ui3';

import { cn } from '@/lib/utils';

function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
	return (
		<LoadingSmallIcon
			role="status"
			aria-label="Loading"
			className={cn('size-6 animate-spin text-icon-secondary', className)}
			{...props}
		/>
	);
}

export { Spinner };
