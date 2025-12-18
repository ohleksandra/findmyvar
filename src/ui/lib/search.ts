import type { Variable } from '../../shared/rpc-types';

enum MatchType {
	EXACT = 0,
	STARTS_WITH = 1,
	WORD_BOUNDARY = 2,
	CONTAINS = 3,
	NO_MATCH = 999,
}

interface ScoredVariable {
	variable: Variable;
	score: number;
	matchType: MatchType;
	/** Index where match starts (for highlighting) */
	matchIndex: number;
}

function scoreVariable(variable: Variable, query: string): ScoredVariable {
	const name = variable.name.toLowerCase();
	const q = query.toLowerCase().trim();

	if (!q) {
		return {
			variable,
			score: MatchType.NO_MATCH,
			matchType: MatchType.NO_MATCH,
			matchIndex: -1,
		};
	}

	if (name === q) {
		return {
			variable,
			score: MatchType.EXACT,
			matchType: MatchType.EXACT,
			matchIndex: 0,
		};
	}

	if (name.startsWith(q)) {
		return {
			variable,
			score: MatchType.STARTS_WITH,
			matchType: MatchType.STARTS_WITH,
			matchIndex: 0,
		};
	}

	const wordBoundaryRegex = new RegExp(`[-_/.]${escapeRegex(q)}`, 'i');
	const boundaryMatch = name.match(wordBoundaryRegex);
	if (boundaryMatch && boundaryMatch.index !== undefined) {
		return {
			variable,
			score: MatchType.WORD_BOUNDARY,
			matchType: MatchType.WORD_BOUNDARY,
			matchIndex: boundaryMatch.index + 1, // +1 to account for the boundary character
		};
	}

	const containsIndex = name.indexOf(q);
	if (containsIndex !== -1) {
		return {
			variable,
			score: MatchType.CONTAINS,
			matchType: MatchType.CONTAINS,
			matchIndex: containsIndex,
		};
	}

	return {
		variable,
		score: MatchType.NO_MATCH,
		matchType: MatchType.NO_MATCH,
		matchIndex: -1,
	};
}

// Escape special regex characters in a string.
function escapeRegex(string: string): string {
	return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function searchVariables(
	variables: Variable[],
	query: string,
	limit: number = 7,
): ScoredVariable[] {
	if (!query.trim()) {
		return [];
	}

	return variables
		.map((variable) => scoreVariable(variable, query))
		.filter((scoredVar) => scoredVar.matchType !== MatchType.NO_MATCH)
		.sort((a, b) => {
			if (a.score !== b.score) {
				return a.score - b.score; // Lower score is better
			}
			if (a.variable.name.length !== b.variable.name.length) {
				return a.variable.name.length - b.variable.name.length;
			}
			return a.variable.name.localeCompare(b.variable.name); // Alphabetical order
		})
		.slice(0, limit);
}

export { MatchType };
export type { ScoredVariable };
