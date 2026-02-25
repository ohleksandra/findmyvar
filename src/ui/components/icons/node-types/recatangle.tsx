import React from 'react';

type Props = React.SVGProps<SVGSVGElement>;

const RectangleIcon = (props: Props) => {
	return (
		<svg viewBox="0 0 10 10" xmlns="http://www.w3.org/2000/svg" {...props}>
			<path
				d="M9 0C9.55228 1.28851e-07 10 0.447715 10 1V9C10 9.55228 9.55228 10 9 10H1C0.447715 10 8.05326e-09 9.55228 0 9V1C1.28852e-07 0.447715 0.447715 8.05319e-09 1 0H9ZM1.5 1C1.22386 1 1 1.22386 1 1.5V8.5C1 8.77614 1.22386 9 1.5 9H8.5C8.77614 9 9 8.77614 9 8.5V1.5C9 1.22386 8.77614 1 8.5 1H1.5Z"
				fill="currentColor"
			/>
		</svg>
	);
};

export default RectangleIcon;
