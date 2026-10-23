import LogoInverted from './icons/logo-inverted';
import { DetachSmallIcon, NavigateForwardIcon, SearchSmallIcon } from './icons/ui3';
import { Button } from './ui/button';
import { useUnusedStore } from '@/store/unused-store';

const Intro = () => {
	const startUnusedScan = useUnusedStore((s) => s.startScan);

	return (
		<div className="w-full h-full flex gap-y-6 flex-col justify-center items-center py-10">
			<LogoInverted className="w-20 h-20" />
			<p className="text-heading-small font-strong text-center">
				Find where variables are used
			</p>
			<div className="flex flex-col text-muted-foreground items-start">
				<p className="flex items-center">
					<SearchSmallIcon className="size-6 text-icon-secondary" />
					<span>Type a variable name to search</span>
				</p>
				<p className="flex items-center">
					<NavigateForwardIcon className="size-6 text-icon-secondary" />
					<span>Click a result to jump to the layer</span>
				</p>
			</div>
			<Button variant="secondary" onClick={() => void startUnusedScan()}>
				<DetachSmallIcon aria-hidden="true" />
				Find unused variables
			</Button>
		</div>
	);
};

export default Intro;
