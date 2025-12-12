import React from 'react';
import { Badge } from './ui/badge';
import InstanceIcon from './instance-icon';
import type { Variable } from '../../shared/rpc-types';

type Props = {
	variable: Variable;
	resultCount: number;
	pagesCount: number;
};

const SearchResultSummary = ({ variable, resultCount, pagesCount }: Props) => {
	return (
		<div className="flex gap-x-1">
			<Badge variant="secondary" className="rounded-sm">
				<InstanceIcon type={variable.resolvedType} className="w-4 h-4" />
				<span className="ml-1 font-mono">{variable.name}</span>
			</Badge>
			<p className="font-sans">
				was found <b>{resultCount}</b> instances accross <b>{pagesCount}</b> pages.
			</p>
		</div>
	);
};

export default SearchResultSummary;
