import React from 'react';
import type { Variable } from '../../shared/rpc-types';
import BooleanIcon from './icons/var-types/boolean-icon';
import NumericIcon from './icons/var-types/numeric-icon';
import TextIcon from './icons/var-types/text-icon';
import ColorIcon from './icons/var-types/color-icon';

type VariableTypeIcon = {
	type: Variable['resolvedType'];
} & React.HTMLAttributes<SVGElement>;

const VARIABLE_TYPE_ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
	BOOLEAN: BooleanIcon,
	FLOAT: NumericIcon,
	STRING: TextIcon,
	COLOR: ColorIcon,
};

const VariableTypeIcon = (props: VariableTypeIcon) => {
	const Icon = VARIABLE_TYPE_ICON_MAP[props.type];
	if (!Icon) return null;
	return <Icon {...props} />;
};

export default VariableTypeIcon;
