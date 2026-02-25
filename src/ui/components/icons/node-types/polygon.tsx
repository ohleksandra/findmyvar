import React from 'react';

type Props = React.SVGProps<SVGSVGElement>;

const PolygonIcon = (props: Props) => {
	return (
		<svg viewBox="0 0 12 10" xmlns="http://www.w3.org/2000/svg" {...props}>
			<path d="M11.1172 9.5H0.882812L6 0.970703L11.1172 9.5Z" stroke="currentColor" />
		</svg>
	);
};

export default PolygonIcon;
