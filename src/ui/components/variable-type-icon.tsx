import React from 'react';
import type { Variable } from '../../shared/rpc-types';
import {
	VARIABLE_TYPE_BOOLEAN,
	VARIABLE_TYPE_COLOR,
	VARIABLE_TYPE_FLOAT,
	VARIABLE_TYPE_STRING,
} from '../../shared/constants';
import BooleanIcon from './icons/var-types/boolean-icon';
import NumericIcon from './icons/var-types/numeric-icon';
import TextIcon from './icons/var-types/text-icon';
import ColorIcon from './icons/var-types/color-icon';

type VariableTypeIcon = {
	type: Variable['resolvedType'];
} & React.HTMLAttributes<SVGElement>;

const VARIABLE_TYPE_ICON_MAP: Record<string, React.ComponentType<React.SVGProps<SVGSVGElement>>> = {
	[VARIABLE_TYPE_BOOLEAN]: BooleanIcon,
	[VARIABLE_TYPE_FLOAT]: NumericIcon,
	[VARIABLE_TYPE_STRING]: TextIcon,
	[VARIABLE_TYPE_COLOR]: ColorIcon,
};

const VariableTypeIcon = (props: VariableTypeIcon) => {
	const Icon = VARIABLE_TYPE_ICON_MAP[props.type];
	if (!Icon) return null;
	return <Icon aria-hidden="true" {...props} />;
};

export default VariableTypeIcon;
