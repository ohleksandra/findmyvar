import { usePluginStore } from '@/store/plugin-store';
import { useShallow } from 'zustand/react/shallow';
import { Spinner } from './ui/spinner';
import { Button } from './ui/button';

const ProgressPane = () => {
	const { searchQuery, cancelSearch } = usePluginStore(
		useShallow((state) => ({
			searchQuery: state.searchQuery,
			progress: state.progress,
			cancelSearch: state.cancelSearch,
		})),
	);

	// const searchProgress = useMemo(
	// 	() =>
	// 		Math.floor(progress?.total > 0 ? (progress?.processed / progress?.total) * 100 : 0) ||
	// 		0,
	// 	[progress],
	// );

	return (
		<div className="flex flex-col px-8 py-4 border-b border-b-[#E5E6E8] gap-y-4">
			<div className="flex items-center">
				<div className="bg-gray-50 border border-[#E5E6E8] rounded-lg p-1.5">
					<Spinner className="size-6" />
				</div>
				<div className="flex flex-col pl-3">
					<p className="font-sans text-sm font-medium">
						Searching for{' '}
						<span className="font-sans font-bold text-sm">'{searchQuery}'</span>
					</p>
					<p className="font-sans text-xs text-[#656B75]">
						Analyzing your document structure and variable usage...
					</p>
				</div>
				<div className="ml-auto">
					<Button
						variant="outline"
						size="sm"
						className="ml-auto"
						onClick={async () => await cancelSearch()}
					>
						Cancel
					</Button>
				</div>
			</div>
			{/* <div>{progress && <Progress value={searchProgress} />}</div> */}
		</div>
	);
};

export default ProgressPane;
