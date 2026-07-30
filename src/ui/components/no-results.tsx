import { usePlugin } from '@/context/plugin-context';
import { Badge } from './ui/badge';

const NoResults = () => {
	const { state } = usePlugin();
	const { searchQuery } = state;

	const displayQuery = searchQuery || '';

	return (
		<div className="flex flex-col w-full h-full justify-center items-center">
			<div className="flex flex-col justify-center gap-y-4 max-w-79.5 items-center">
				<div className="flex gap-x-1">
					<p className="font-medium text-nowrap">No results found for</p>
					<Badge
						variant="secondary"
						className="rounded-sm flex items-center justify-start font-medium max-w-35"
					>
						<span className="font-mono overflow-ellipsis whitespace-nowrap overflow-x-hidden font-medium">
							{displayQuery}
						</span>
					</Badge>
				</div>
				<p className="text-center leading-5 text-sm">
					This variable doesn't appear to be used anywhere in your document. Try checking
					the variable name or expanding your search scope
				</p>
			</div>
		</div>
	);
};

export default NoResults;
