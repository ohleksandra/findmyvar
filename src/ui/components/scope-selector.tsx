import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { usePlugin } from '@/context/plugin-context';
import type { SearchScope } from '../../shared/rpc-types';
import { cn } from '@/lib/utils';

type Props = React.HTMLAttributes<HTMLDivElement>;

// Concentric corners: the chip keeps radius-md (5px) and the rail around it has 2px padding,
// so the rail is 5 + 2 = 7px. The outline sits inside the chip so it doesn't widen the corner.
const SEGMENT =
	'h-5 rounded-md data-[state=active]:bg-background data-[state=active]:ring-1 data-[state=active]:ring-inset data-[state=active]:ring-border';

const ScopeSelector = (props: Props) => {
	const { state, actions } = usePlugin();
	const { isSearching, scope } = state;
	const { setSearchScope } = actions;

	return (
		<div className={cn('flex items-center gap-x-2', props.className)}>
			<p className="text-muted-foreground">Scope</p>
			<Tabs value={scope} onValueChange={(value) => setSearchScope(value as SearchScope)}>
				{/* Segmented control: tabs sit on a rail, the selected one is raised. */}
				<TabsList className="gap-0 rounded-[7px] bg-secondary p-0.5">
					<TabsTrigger value="all-pages" disabled={isSearching} className={SEGMENT}>
						All Pages
					</TabsTrigger>
					<TabsTrigger value="current-page" disabled={isSearching} className={SEGMENT}>
						Current Page
					</TabsTrigger>
					<TabsTrigger value="selection" disabled={isSearching} className={SEGMENT}>
						Selection
					</TabsTrigger>
				</TabsList>
			</Tabs>
		</div>
	);
};

export default ScopeSelector;
