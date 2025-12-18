import React from 'react';
import type { Variable } from '../../shared/rpc-types';
import BooleanIcon from './icons/var-types/boolean-icon';
import NumericIcon from './icons/var-types/numeric-icon';
import TextIcon from './icons/var-types/text-icon';
import ColorIcon from './icons/var-types/color-icon';

type InstanceIconProps = {
	type: Variable['resolvedType'];
} & React.HTMLAttributes<SVGElement>;

const InstanceIcon = (props: InstanceIconProps) => {
	switch (props.type) {
		case 'BOOLEAN':
			return <BooleanIcon {...props} />;
		case 'FLOAT':
			return <NumericIcon {...props} />;
		case 'STRING':
			return <TextIcon {...props} />;
		case 'COLOR':
			return <ColorIcon {...props} />;
		default:
			return null;
	}
};

export default InstanceIcon;
