import { Badge } from './ui/badge';
import VariableTypeIcon from './variable-type-icon';
import type { Variable } from '../../shared/rpc-types';

type Props = {
	variable: Variable;
	resultCount: number;
	pagesCount: number;
	/** The search was stopped early, so counts are only what was found so far. */
	isPartial?: boolean;
};

const SearchResultSummary = ({ variable, resultCount, pagesCount, isPartial = false }: Props) => {
	return (
		<div className="flex gap-x-1 items-center min-w-0">
			<Badge variant="selected" className="max-w-42 justify-start h-5 pl-0 pr-1.5">
				<VariableTypeIcon type={variable.resolvedType} className="size-5! shrink-0" />
				<span className="truncate">{variable.name}</span>
			</Badge>
			<p className="text-muted-foreground whitespace-nowrap">
				<span className="text-foreground font-strong">{resultCount}</span> uses on{' '}
				<span className="text-foreground font-strong">{pagesCount}</span>{' '}
				{pagesCount === 1 ? 'page' : 'pages'}
				{isPartial && ' so far'}
			</p>
		</div>
	);
};

export default SearchResultSummary;
