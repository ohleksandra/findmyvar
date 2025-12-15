import React from 'react';
import type { VariableUsage } from '../../shared/rpc-types';
import { usePluginStore } from '@/store/plugin-store';
import { Button } from './ui/button';

type VariableUsageProps = {
	variable: VariableUsage;
};

const VariableUsage = ({ variable }: VariableUsageProps) => {
	const navigateToResult = usePluginStore((state) => state.navigateToResult);

	return (
		<div className="flex gap-x-2">
			<div>Node type: {variable.nodeType}</div>
			<div>Node name {variable.nodeName}</div>
			<div>Field: {variable.field}</div>
			<Button type="button" size="sm" onClick={async () => await navigateToResult(variable)}>
				Navigate
			</Button>
		</div>
	);
};

export default VariableUsage;

//
