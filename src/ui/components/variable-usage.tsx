import type { VariableUsage as VariableUsageData } from '../../shared/rpc-types';
import { usePlugin } from '@/context/plugin-context';
import NodeIcon from './node-icon';
import { ArrowUpRight } from 'lucide-react';

type VariableUsageProps = {
	variable: VariableUsageData;
};

// Laid out like a UI3 layers-panel row: node icon, name and bound field, path underneath.
const VariableUsage = ({ variable }: VariableUsageProps) => {
	const {
		actions: { navigateToResult },
	} = usePlugin();

	return (
		<button
			type="button"
			className="group flex w-full h-10 items-center pl-8 pr-2 gap-x-2 text-left outline-none hover:bg-hover focus-visible:outline-1 focus-visible:outline-border-selected focus-visible:-outline-offset-1"
			onClick={async () => await navigateToResult(variable)}
		>
			<div className="flex size-4 shrink-0 justify-center items-center self-start mt-1">
				<NodeIcon type={variable.nodeType} className="text-icon-secondary size-2.5" />
			</div>
			<div className="flex flex-col min-w-0">
				<div className="flex gap-x-1.5 items-center min-w-0">
					<p className="truncate">{variable.nodeName}</p>
					<span className="shrink-0 rounded-sm bg-secondary px-1 text-body-small text-muted-foreground capitalize">
						{variable.field}
					</span>
				</div>
				<p className="truncate text-muted-foreground">{variable.nodePath}</p>
			</div>
			<ArrowUpRight
				className="ml-auto mr-1 size-4 shrink-0 text-icon-secondary invisible group-hover:visible group-focus-visible:visible"
				strokeWidth={1.5}
				aria-hidden="true"
			/>
		</button>
	);
};

export default VariableUsage;
