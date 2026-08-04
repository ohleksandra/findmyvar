import { Tabs, TabsList, TabsTrigger } from './ui/tabs';
import { usePlugin } from '@/context/plugin-context';
import type { SearchScope } from '../../shared/rpc-types';
import { DEFAULT_SCOPE } from '../../shared/constants';
import { cn } from '@/lib/utils';

type Props = React.HTMLAttributes<HTMLDivElement>;

const ScopeSelector = (props: Props) => {
	const { state, actions } = usePlugin();
	const { isSearching } = state;
	const { setSearchScope } = actions;

	return (
		<div className={cn('flex items-center gap-x-2', props.className)}>
			<p className="font-sans text-sm font-medium">Scope:</p>
			<Tabs
				defaultValue={DEFAULT_SCOPE}
				onValueChange={(value) => setSearchScope(value as SearchScope)}
			>
				<TabsList className="bg-[#E5E6E8] text-sm font-medium font-sans">
					<TabsTrigger
						value="all-pages"
						className="hover:cursor-pointer"
						disabled={isSearching}
					>
						All Pages
					</TabsTrigger>
					<TabsTrigger
						value="current-page"
						className="hover:cursor-pointer"
						disabled={isSearching}
					>
						Current Page
					</TabsTrigger>
					<TabsTrigger
						value="selection"
						className="hover:cursor-pointer"
						disabled={isSearching}
					>
						Selection
					</TabsTrigger>
				</TabsList>
			</Tabs>
		</div>
	);
};

export default ScopeSelector;
