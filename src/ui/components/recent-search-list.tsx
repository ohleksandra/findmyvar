import { usePluginStore } from '@/store/plugin-store';
import { Badge } from './ui/badge';
import { useShallow } from 'zustand/react/shallow';
import VariableTypeIcon from './variable-type-icon';
import { cn } from '@/lib/utils';

type Props = React.HTMLAttributes<HTMLDivElement>;

const RecentSearchList = (props: Props) => {
	const { recentSearches, startSearch, setSearchQuery } = usePluginStore(
		useShallow((state) => ({
			recentSearches: state.recentSearches,
			startSearch: state.startSearch,
			setSearchQuery: state.setSearchQuery,
		})),
	);

	return (
		<div className={cn('flex flex-col gap-y-2', props.className)}>
			<p className="text-xs not-first:font-medium text-[#656B75] font-sans">
				Recent searches:
			</p>
			<ul className="flex gap-x-1 gap-y-1.5 flex-wrap">
				{recentSearches.map((variable) => (
					<li key={variable.id}>
						<Badge
							variant={'secondary'}
							className="cursor-pointer flex items-center gap-1 bg-[#E5E6E8] rounded-md font-mono"
							onClick={async () => {
								setSearchQuery(variable.name);
								await startSearch(variable);
							}}
						>
							<VariableTypeIcon className="size-4!" type={variable.resolvedType} />
							<span className="text-xs">{variable.name}</span>
						</Badge>
					</li>
				))}
			</ul>
		</div>
	);
};

export default RecentSearchList;
