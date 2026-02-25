import React from 'react';

type Props = React.SVGProps<SVGSVGElement>;

const EllipseIcon = (props: Props) => {
	return (
		<svg viewBox="0 0 12 12" xmlns="http://www.w3.org/2000/svg" fill="none" {...props}>
			<path
				d="M6 0.5C9.03756 0.5 11.5 2.96244 11.5 6C11.5 9.03756 9.03756 11.5 6 11.5C2.96244 11.5 0.5 9.03756 0.5 6C0.5 2.96244 2.96244 0.5 6 0.5Z"
				stroke="currentColor"
			/>
		</svg>
	);
};

export default EllipseIcon;
