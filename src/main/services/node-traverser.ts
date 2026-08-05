const NODES_PER_YIELD = 200;

function hasBoundVariables(node: SceneNode): boolean {
	return 'boundVariables' in node && node.boundVariables !== null;
}

function yieldToMain(): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, 0));
}

async function* findNodesWithBindingsAsync(
	node: SceneNode,
	signal: { cancelled: boolean },
): AsyncGenerator<SceneNode, void, void> {
	let nodesVisited = 0;

	const traverse = async function* (
		currentNode: SceneNode,
	): AsyncGenerator<SceneNode, void, void> {
		if (signal.cancelled) return;

		if (hasBoundVariables(currentNode)) {
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

export { findNodesWithBindingsAsync, yieldToMain };
