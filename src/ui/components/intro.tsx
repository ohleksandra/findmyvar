import LogoInverted from './icons/logo-inverted';
import { DetachSmallIcon, NavigateForwardIcon, SearchSmallIcon } from './icons/ui3';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { useUnusedStore } from '@/store/unused-store';

/** Says what the unused scan does, or points back to the tab when one is already open. */
const UnusedToolCard = () => {
	const isOpen = useUnusedStore((s) => s.isOpen);
	const status = useUnusedStore((s) => s.status);
	const unusedCount = useUnusedStore((s) => s.result?.unused.length);
	const startScan = useUnusedStore((s) => s.startScan);
	const showUnused = useUnusedStore((s) => s.showUnused);

	let description = 'Scans every page for variables nothing in the file uses.';
	if (isOpen && status === 'scanning') {
		description = 'Scan in progress.';
	} else if (isOpen && status === 'error') {
		description = "The last scan didn't finish.";
	} else if (isOpen && unusedCount !== undefined) {
		description =
			unusedCount === 0
				? 'No unused variables in the last scan.'
				: `${unusedCount} unused ${unusedCount === 1 ? 'variable' : 'variables'} in the last scan.`;
	}

	return (
		<section
			aria-labelledby="unused-tool-title"
			className="flex w-full items-center gap-x-2 rounded-xl border bg-secondary p-3"
		>
			<span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-background">
				<DetachSmallIcon className="size-6 text-icon-secondary" aria-hidden="true" />
			</span>
			<div className="flex min-w-0 flex-1 flex-col">
				<p className="flex items-center gap-x-1">
					<span id="unused-tool-title" className="font-strong">
						Find unused variables
					</span>
					<Badge variant="new">New</Badge>
				</p>
				<p className="text-muted-foreground">{description}</p>
			</div>
			{isOpen ? (
				<Button variant="secondary" onClick={showUnused}>
					View
				</Button>
			) : (
				<Button variant="secondary" onClick={() => void startScan()}>
					Scan file
				</Button>
			)}
		</section>
	);
};

const Intro = () => (
	<div className="w-full h-full flex flex-col">
		<div className="flex flex-1 gap-y-6 flex-col justify-center items-center px-4 py-10">
			<LogoInverted className="w-20 h-20" aria-hidden="true" />
			{/* Heading and tips are one group, so they sit closer together than to the logo. */}
			<div className="flex flex-col items-center gap-y-3">
				<h1 className="text-heading-medium font-strong text-center">
					Find where variables are used
				</h1>
				<div className="flex flex-col text-body-large text-muted-foreground items-start">
					<p className="flex items-center">
						<SearchSmallIcon
							className="size-6 text-icon-secondary"
							aria-hidden="true"
						/>
						<span>Type a variable name to search</span>
					</p>
					<p className="flex items-center">
						<NavigateForwardIcon
							className="size-6 text-icon-secondary"
							aria-hidden="true"
						/>
						<span>Click a result to jump to the layer</span>
					</p>
				</div>
			</div>
		</div>
		{/* Pinned to the bottom so it doesn't compete with the search guidance above. */}
		<div className="px-4 pb-4">
			<UnusedToolCard />
		</div>
	</div>
);

export default Intro;
