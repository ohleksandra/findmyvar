const NODES_PER_YIELD = 200;

function hasBoundVariables(node: SceneNode): boolean {
	return 'boundVariables' in node && node.boundVariables !== null;
}

/**
 * Layers that can hold a variable: in `boundVariables`, or nested in paints, effects, layout grids
 * or component property definitions (see `forEachNestedBinding`). Components and component sets
 * have fills, so they're included.
 */
function mayHaveBindings(node: SceneNode): boolean {
	return (
		hasBoundVariables(node) ||
		'fills' in node ||
		'strokes' in node ||
		'effects' in node ||
		'layoutGrids' in node
	);
}

function yieldToMain(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

async function* findNodesWithBindingsAsync(
	node: SceneNode,
	signal: { cancelled: boolean },
	include: (node: SceneNode) => boolean = mayHaveBindings,
): AsyncGenerator<SceneNode, void, void> {
	let nodesVisited = 0;

	const traverse = async function* (
		currentNode: SceneNode,
	): AsyncGenerator<SceneNode, void, void> {
		if (signal.cancelled) return;

		if (include(currentNode)) {
			yield currentNode;
		}

		if ('children' in currentNode) {
			for (const child of currentNode.children) {
				if (signal.cancelled) return;

				nodesVisited++;
				if (nodesVisited % NODES_PER_YIELD === 0) {
					await yieldToMain();
				}

				yield* traverse(child as SceneNode);
			}
		}
	};

	yield* traverse(node);
}

export { findNodesWithBindingsAsync, hasBoundVariables, mayHaveBindings, yieldToMain };
