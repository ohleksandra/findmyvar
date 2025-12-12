import { usePluginStore } from '@/store/plugin-store';
import { useShallow } from 'zustand/react/shallow';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './ui/accordion';
import { Badge } from './ui/badge';
import InstanceIcon from './instance-icon';
import { useMemo } from 'react';
import SearchResultSummary from './search-result-summary';

const SearchResult = () => {
	const { searchResults, searchVariable } = usePluginStore(
		useShallow((state) => ({
			searchResults: state.searchResults,
			searchVariable: state.searchVariable,
		})),
	);

	const pagesCount = useMemo(() => {
		const uniquePages = new Set(searchResults.map((result) => result.pageName));
		return uniquePages.size;
	}, [searchResults]);

	return (
		<div className="overflow-y-auto">
			{searchResults.length === 0 ? (
				<div className="p-2 text-gray-500">No results found.</div>
			) : (
				<div className="flex flex-col">
					<div className="flex px-6 py-3 border-b">
						<SearchResultSummary
							variable={searchVariable!}
							resultCount={searchResults.length}
							pagesCount={pagesCount}
						/>
					</div>
					<Accordion type="multiple" className="w-full">
						{Object.entries(
							searchResults.reduce(
								(acc, result) => {
									if (!acc[result.pageName]) acc[result.pageName] = [];
									acc[result.pageName].push(result);
									return acc;
								},
								{} as Record<string, typeof searchResults>,
							),
						).map(([pageName, results]) => (
							<AccordionItem key={pageName} value={pageName}>
								<AccordionTrigger className="font-sans font-semibold text-sm px-6">
									{pageName}

									<Badge className="ml-auto rounded-sm" variant="secondary">
										{results.length}
									</Badge>
								</AccordionTrigger>
								<AccordionContent>
									{results.map((result, idx) => (
										<div key={idx} className="border-b px-6">
											<div>Variable used in Node ID: {result.nodeId}</div>
											<div>Page ID: {result.pageId}</div>
										</div>
									))}
								</AccordionContent>
							</AccordionItem>
						))}
					</Accordion>
				</div>
			)}
		</div>
	);
};

export default SearchResult;
