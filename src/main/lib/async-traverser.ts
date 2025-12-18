export interface TraversalContext {
	node: SceneNode;
	pageId: string;
	pageName: string;
}

interface TraversalCallbacks {
	onNode: (ctx: TraversalContext) => boolean | void;
	shouldCancel: () => boolean;
}

export class AsyncTreeTraverser {
	constructor(private config: { chunkSize: number }) {}

	async countNodesInPages(pages: readonly PageNode[]): Promise<number> {
		let total = 0;
		for (const page of pages) {
			total += await this.countSubtree(page.children as SceneNode[]);
		}
		return total;
	}

	async countNodesInRoots(roots: readonly SceneNode[]): Promise<number> {
		return this.countSubtree(roots);
	}

	private async countSubtree(roots: readonly SceneNode[]): Promise<number> {
		let total = 0;
		const stack: SceneNode[] = [...roots];

		while (stack.length > 0) {
			const node = stack.pop()!;
			total++;

			if ('children' in node) {
				stack.push(...(node.children as SceneNode[]));
			}

			if (total % 1000 === 0) {
				await this.yield();
			}
		}

		return total;
	}

	async traversePages(
		pages: readonly PageNode[],
		callbacks: TraversalCallbacks,
	): Promise<{ processedCount: number; wasCancelled: boolean }> {
		let processedCount = 0;

		for (const page of pages) {
			if (callbacks.shouldCancel()) {
				return { processedCount, wasCancelled: true };
			}

			const result = await this.traverseSubtree(
				page.children as SceneNode[],
				{ id: page.id, name: page.name },
				callbacks,
			);

			processedCount += result.processedCount;
			if (result.wasCancelled) {
				return { processedCount, wasCancelled: true };
			}
		}

		return { processedCount, wasCancelled: false };
	}

	async traverseNodes(
		roots: readonly SceneNode[],
		pageContext: { id: string; name: string },
		callbacks: TraversalCallbacks,
	): Promise<{ processedCount: number; wasCancelled: boolean }> {
		return this.traverseSubtree([...roots], pageContext, callbacks);
	}

	private async traverseSubtree(
		roots: SceneNode[],
		pageContext: { id: string; name: string },
		callbacks: TraversalCallbacks,
	): Promise<{ processedCount: number; wasCancelled: boolean }> {
		const stack: SceneNode[] = [...roots];
		let processedCount = 0;
		let chunkCount = 0;

		while (stack.length > 0) {
			if (chunkCount >= this.config.chunkSize) {
				if (callbacks.shouldCancel()) {
					return { processedCount, wasCancelled: true };
				}
				await this.yield();
				chunkCount = 0;
			}

			const node = stack.pop()!;

			const shouldContinue = callbacks.onNode({
				node,
				pageId: pageContext.id,
				pageName: pageContext.name,
			});

			processedCount++;
			chunkCount++;

			if (shouldContinue !== false && 'children' in node) {
				for (let i = node.children.length - 1; i >= 0; i--) {
					stack.push(node.children[i] as SceneNode);
				}
			}
		}

		return { processedCount, wasCancelled: false };
	}

	private yield(): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, 0));
	}
}
