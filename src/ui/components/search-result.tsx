import { usePlugin } from '@/context/plugin-context';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Badge } from './ui/badge';
import { useMemo, useRef } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { VariableUsage as VariableUsageType } from '../../shared/rpc-types';
import SearchResultSummary from './search-result-summary';
import VariableUsage from './variable-usage';

const ESTIMATED_ROW_HEIGHT = 60;

const VirtualizedResultList = ({ results }: { results: VariableUsageType[] }) => {
	const parentRef = useRef<HTMLDivElement>(null);

	const virtualizer = useVirtualizer({
		count: results.length,
		getScrollElement: () => parentRef.current,
		estimateSize: () => ESTIMATED_ROW_HEIGHT,
		overscan: 5,
	});

	return (
		<div ref={parentRef} className="overflow-auto" style={{ maxHeight: '400px' }}>
			<div
				style={{
					height: `${virtualizer.getTotalSize()}px`,
					width: '100%',
					position: 'relative',
				}}
			>
				{virtualizer.getVirtualItems().map((virtualRow) => {
					const result = results[virtualRow.index];
					return (
						<div
							key={virtualRow.key}
							style={{
								position: 'absolute',
								top: 0,
								left: 0,
								width: '100%',
								height: `${virtualRow.size}px`,
								transform: `translateY(${virtualRow.start}px)`,
							}}
						>
							<VariableUsage variable={result} />
						</div>
					);
				})}
			</div>
		</div>
	);
};

const SearchResult = () => {
	const { state } = usePlugin();
	const { searchResults, searchVariable, isSearchCompleted } = state;

	const pagesCount = useMemo(() => {
		const uniquePages = new Set(searchResults.map((result) => result.pageName));
		return uniquePages.size;
	}, [searchResults]);

	return (
		<div className="flex flex-col relative">
			{isSearchCompleted && (
				<div className="flex px-6 py-3 border-b sticky top-0 bg-white z-20">
					<SearchResultSummary
						variable={searchVariable!}
						resultCount={searchResults.length}
						pagesCount={pagesCount}
					/>
				</div>
			)}
			<Accordion type="multiple" className="w-full" aria-label="Search results by page">
				{Object.entries(
					searchResults.reduce((acc: Record<string, VariableUsageType[]>, result) => {
						if (!acc[result.pageName]) acc[result.pageName] = [];
						acc[result.pageName].push(result);
						return acc;
					}, {}),
				).map(([pageName, results]) => (
					<AccordionItem key={pageName} value={pageName}>
						<AccordionTrigger className="font-sans font-semibold text-sm px-6">
							{pageName}

							<Badge className="ml-auto rounded-sm px-1.5 py-0.5" variant="secondary">
								{results.length}
							</Badge>
						</AccordionTrigger>
						<AccordionContent>
							<VirtualizedResultList results={results} />
						</AccordionContent>
					</AccordionItem>
				))}
			</Accordion>
		</div>
	);
};

export default SearchResult;
