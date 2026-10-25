import { usePlugin } from '@/context/plugin-context';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { SearchSmallIcon } from './icons/ui3';

const SearchStopped = () => {
	const { state, actions } = usePlugin();
	const { searchQuery, searchVariable } = state;

	const displayQuery = searchVariable?.name || searchQuery || '';

	return (
		<div className="flex flex-col w-full h-full justify-center items-center">
			<div className="flex flex-col justify-center gap-y-2 max-w-64 items-center py-10">
				<div className="flex gap-x-1 items-center">
					<p className="text-heading-small font-strong text-nowrap">Search stopped</p>
					<Badge variant="secondary" className="justify-start max-w-35 h-5">
						<span className="truncate">{displayQuery}</span>
					</Badge>
				</div>
				<p className="text-center text-muted-foreground">
					No layers found before you stopped. That doesn't mean this variable is unused.
				</p>
				{searchVariable && (
					<Button
						variant="secondary"
						className="mt-1"
						onClick={() => void actions.startSearch(searchVariable)}
					>
						<SearchSmallIcon aria-hidden="true" />
						Search again
					</Button>
				)}
			</div>
		</div>
	);
};

export default SearchStopped;
