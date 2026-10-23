import { usePlugin } from '@/context/plugin-context';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { DetachSmallIcon } from './icons/ui3';
import { SCOPE_ALL_PAGES } from '../../shared/constants';
import { useUnusedStore } from '@/store/unused-store';

const NoResults = () => {
	const { state } = usePlugin();
	const startUnusedScan = useUnusedStore((s) => s.startScan);
	const { searchQuery, searchVariable, scope } = state;

	const displayQuery = searchVariable?.name || searchQuery || '';
	const searchedWholeFile = scope === SCOPE_ALL_PAGES;

	return (
		<div className="flex flex-col w-full h-full justify-center items-center">
			<div className="flex flex-col justify-center gap-y-2 max-w-64 items-center py-10">
				<div className="flex gap-x-1 items-center">
					<p className="text-heading-small font-strong text-nowrap">
						{searchedWholeFile ? 'No layers use' : 'No results for'}
					</p>
					<Badge variant="secondary" className="justify-start max-w-35 h-5">
						<span className="truncate">{displayQuery}</span>
					</Badge>
				</div>
				{searchedWholeFile ? (
					<>
						<p className="text-center text-muted-foreground">
							Other variables may still reference it. Check what's truly unused.
						</p>
						<Button
							variant="secondary"
							className="mt-1"
							onClick={() => void startUnusedScan()}
						>
							<DetachSmallIcon aria-hidden="true" />
							Find unused variables
						</Button>
					</>
				) : (
					<p className="text-center text-muted-foreground">
						This variable isn't used in the current scope. Try searching all pages to
						check the whole file.
					</p>
				)}
			</div>
		</div>
	);
};

export default NoResults;
