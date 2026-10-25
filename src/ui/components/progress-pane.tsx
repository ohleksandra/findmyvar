import { usePlugin } from '@/context/plugin-context';
import { Spinner } from './ui/spinner';
import { Button } from './ui/button';
import { useMemo } from 'react';
import { Progress } from './ui/progress';

const ProgressPane = () => {
	const { state, actions } = usePlugin();
	const { searchQuery, progress, isSearching } = state;
	const { cancelSearch } = actions;

	const searchProgress = useMemo(() => {
		if (!progress) return 0;
		return Math.floor(progress.total > 0 ? (progress.processed / progress.total) * 100 : 0);
	}, [progress]);

	return (
		<div className="flex flex-col px-4 py-3 border-b gap-y-3">
			<div className="flex items-center gap-x-1">
				<Spinner className="-ml-1" />
				<div className="flex flex-col min-w-0">
					<p className="truncate">
						Searching for <span className="font-strong">{searchQuery}</span>
					</p>
					<p className="text-muted-foreground">Checking layers that use this variable…</p>
				</div>
				<div className="ml-auto pl-2">
					<Button variant="secondary" onClick={async () => await cancelSearch()}>
						Cancel
					</Button>
				</div>
			</div>
			<div>
				{isSearching && (
					<Progress
						value={searchProgress}
						aria-valuetext={`${searchProgress}% complete`}
					/>
				)}
			</div>
		</div>
	);
};

export default ProgressPane;
