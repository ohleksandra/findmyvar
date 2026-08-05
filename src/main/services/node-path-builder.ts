function buildNodePath(node: SceneNode, pathCache?: Map<string, string>): string {
	const parent = node.parent;
	if (!parent) {
		return '';
	}

	if (pathCache) {
		const cached = pathCache.get(parent.id);
		if (cached !== undefined) {
			return cached;
		}
	}

	const path: BaseNode[] = [];
	let current: BaseNode | null = parent;

	while (current && current.type !== 'PAGE' && current.type !== 'SECTION') {
		path.unshift(current);
		current = current.parent;
	}

	if (path.length < 2) {
		const result = path[0]?.name?.trim() || '';
		if (pathCache) {
			pathCache.set(parent.id, result);
		}
		return result;
	}

	let highestName = '';
	for (const pathNode of path.slice(0, -1)) {
		const name = pathNode.name?.trim();
		if (name) {
			highestName = name;
			break;
		}
	}

	const parentName = path[path.length - 1].name?.trim() || '';

	if (!highestName || !parentName) {
		if (pathCache) {
			pathCache.set(parent.id, '');
		}
		return '';
	}

	const result = `${highestName}/.../${parentName}`;
	if (pathCache) {
		pathCache.set(parent.id, result);
	}
	return result;
}

export { buildNodePath };
