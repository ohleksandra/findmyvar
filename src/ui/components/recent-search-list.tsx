import { usePlugin } from '@/context/plugin-context';
import { Badge } from './ui/badge';
import VariableTypeIcon from './variable-type-icon';
import { cn } from '@/lib/utils';

type Props = React.HTMLAttributes<HTMLDivElement>;

const RecentSearchList = (props: Props) => {
	const { state, actions } = usePlugin();
	const { recentSearches } = state;
	const { startSearch, setSearchQuery } = actions;

	return (
		<div className={cn('flex flex-col gap-y-2', props.className)}>
			<p className="text-muted-foreground">Recent</p>
			<ul className="flex gap-1 flex-wrap">
				{recentSearches.map((variable) => (
					<li key={variable.id}>
						<Badge
							asChild
							variant={'secondary'}
							className="h-6 max-w-full gap-0 pr-2 pl-0 hover:bg-tertiary"
						>
							<button
								type="button"
								aria-label={`Search again for ${variable.name}`}
								onClick={async () => {
									setSearchQuery(variable.name);
									await startSearch(variable);
								}}
							>
								<VariableTypeIcon
									className="size-6! text-icon-secondary"
									type={variable.resolvedType}
									aria-hidden="true"
								/>
								<span className="truncate">{variable.name}</span>
							</button>
						</Badge>
					</li>
				))}
			</ul>
		</div>
	);
};

export default RecentSearchList;
