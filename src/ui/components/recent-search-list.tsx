import { usePluginStore } from '@/store/plugin-store';
import { Badge } from './ui/badge';
import { useShallow } from 'zustand/react/shallow';
import InstanceIcon from './instance-icon';

const RecentSearchList = () => {
	const { recentSearches, startSearch, setSearchQuery } = usePluginStore(
		useShallow((state) => ({
			recentSearches: state.recentSearches,
			startSearch: state.startSearch,
			setSearchQuery: state.setSearchQuery,
		})),
	);

	return (
		<>
			<p className="text-xs font-medium text-[#656B75] font-sans">Recent searches:</p>
			<ul className="flex gap-1">
				{Array.from(recentSearches.values()).map((variable) => (
					<li key={variable.id}>
						<Badge
							variant={'secondary'}
							className="cursor-pointer flex items-center gap-1 bg-[#E5E6E8] rounded-md font-mono"
							onClick={async () => {
								setSearchQuery(variable.name);
								await startSearch(variable);
							}}
						>
							<InstanceIcon type={variable.resolvedType} />
							<span className="text-xs">{variable.name}</span>
						</Badge>
					</li>
				))}
			</ul>
		</>
	);
};

export default RecentSearchList;
