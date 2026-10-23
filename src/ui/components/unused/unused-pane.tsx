import { useEffect, useRef } from 'react';
import { ApprovedCheckmarkIcon, DetachSmallIcon } from '../icons/ui3';
import { useUnusedStore } from '@/store/unused-store';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Spinner } from '../ui/spinner';
import UnusedResults from './unused-results';

const IS_MAC = typeof navigator !== 'undefined' && /Mac/i.test(navigator.platform);
const UNDO_SHORTCUT = IS_MAC ? '⌘Z' : 'Ctrl+Z';

const ScanProgress = () => {
	const progress = useUnusedStore((s) => s.progress);
	const cancelScan = useUnusedStore((s) => s.cancelScan);

	const percent = progress?.total ? Math.floor((progress.processed / progress.total) * 100) : 0;

	return (
		<div className="flex flex-col px-4 py-3 border-b gap-y-3">
			<div className="flex items-center gap-x-1">
				<Spinner className="-ml-1" />
				<div className="flex flex-col min-w-0">
					<p>Scanning…</p>
					<p className="text-muted-foreground truncate" aria-live="polite">
						{progress
							? `Page ${progress.pageIndex + 1} of ${progress.pageCount} · ${progress.currentPage}`
							: 'Loading pages'}
					</p>
				</div>
				<Button variant="secondary" className="ml-auto" onClick={() => void cancelScan()}>
					Cancel
				</Button>
			</div>
			<Progress value={percent} aria-valuetext={`${percent}% complete`} />
		</div>
	);
};

const ScanPrompt = ({ title, description }: { title: string; description: string }) => {
	const startScan = useUnusedStore((s) => s.startScan);

	return (
		<div className="flex flex-col w-full h-full justify-center items-center px-4 py-16">
			<div className="flex flex-col justify-center gap-y-1 max-w-64 items-center text-center">
				<DetachSmallIcon className="size-6 text-icon-secondary" aria-hidden="true" />
				<p className="text-heading-small font-strong">{title}</p>
				<p className="text-muted-foreground">{description}</p>
				<Button className="mt-2" onClick={() => void startScan()}>
					Scan file
				</Button>
			</div>
		</div>
	);
};

const Deleted = () => {
	const deleteResult = useUnusedStore((s) => s.deleteResult);
	const startScan = useUnusedStore((s) => s.startScan);
	const headingRef = useRef<HTMLParagraphElement>(null);
	const count = deleteResult?.deletedIds.length ?? 0;

	useEffect(() => {
		headingRef.current?.focus();
	}, []);

	return (
		<div className="flex flex-col w-full h-full justify-center items-center px-4 py-16">
			<div className="flex flex-col justify-center gap-y-1 max-w-64 items-center text-center">
				<ApprovedCheckmarkIcon className="size-6 text-success" aria-hidden="true" />
				<p
					ref={headingRef}
					tabIndex={-1}
					className="text-heading-small font-strong outline-none"
				>
					{count} variable{count === 1 ? '' : 's'} deleted
				</p>
				{deleteResult?.versionSaved && (
					<p className="text-muted-foreground">Version saved: Before FindMyVar cleanup</p>
				)}
				<p className="text-muted-foreground">
					Undo with {UNDO_SHORTCUT} or from Version history
				</p>
				<Button variant="secondary" className="mt-2" onClick={() => void startScan()}>
					Back to results
				</Button>
			</div>
		</div>
	);
};

const UnusedPane = () => {
	const status = useUnusedStore((s) => s.status);
	const error = useUnusedStore((s) => s.error);
	const deleteStatus = useUnusedStore((s) => s.deleteStatus);

	if (status === 'scanning') return <ScanProgress />;
	if (status === 'error') {
		return (
			<ScanPrompt
				title="The scan didn't finish"
				description={error ?? 'Something went wrong. Try scanning again.'}
			/>
		);
	}
	if (status === 'done') {
		return deleteStatus === 'done' ? <Deleted /> : <UnusedResults />;
	}
	return (
		<ScanPrompt
			title="Find unused variables"
			description="Checks every page once and lists the variables nothing uses."
		/>
	);
};

export default UnusedPane;
