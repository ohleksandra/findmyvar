import { cn } from '@/lib/utils';
import type { VariableUsage } from '../../shared/rpc-types';
import { usePluginStore } from '@/store/plugin-store';
import { ArrowUpRight, Component } from 'lucide-react';
import { useState } from 'react';

type VariableUsageProps = {
	variable: VariableUsage;
};

const VariableUsage = ({ variable }: VariableUsageProps) => {
	const navigateToResult = usePluginStore((state) => state.navigateToResult);

	const [isHovered, setIsHovered] = useState(false);

	return (
		<div className="flex gap-x-2">
			{/* <div>Node type: {variable.nodeType}</div>
			<div>Node name {variable.nodeName}</div>
			<div>Field: {variable.field}</div>
			<Button type="button" size="sm" onClick={async () => await navigateToResult(variable)}>
				Navigate
			</Button> */}

			<button
				type="button"
				className={cn(
					'flex w-full pl-7 pr-5 py-1.5 cursor-pointer',
					isHovered ? 'bg-[#F5F5F6]' : 'bg-white',
				)}
				onMouseEnter={() => setIsHovered(true)}
				onMouseLeave={() => setIsHovered(false)}
				onClick={async () => await navigateToResult(variable)}
			>
				<div>
					<Component />
				</div>
				<div className="flex flex-col items-start ml-1">
					<div className="flex font-sans font-medium gap-x-2 items-center">
						<p
							className={cn(
								'font-sans font-medium text-xs leading-4',
								isHovered ? 'underline' : '',
							)}
						>
							{variable.nodeName}
						</p>
						<span className="bg-[#DBEAFE] rounded-sm font-sans font-medium text-[10px] px-1 leading-3">
							{variable.field}
						</span>
					</div>
					<p className="text-[10px] leading-3 font-sans">
						Highest parent/ ... / Parent_container/Container
					</p>
				</div>
				<div className="flex ml-auto">
					{isHovered && <ArrowUpRight className="text-[#17181A]" />}
				</div>
			</button>
		</div>
	);
};

export default VariableUsage;

//
