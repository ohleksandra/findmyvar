import React from 'react';
import LogoInverted from './icons/logo-inverted';
import { LocateFixed, Search } from 'lucide-react';

const Intro = () => {
	return (
		<div className="w-full h-full flex gap-y-8 flex-col justify-center items-center">
			<p className="font-sans text-sm text-[#3A3C3F] text-center">
				Find where variables <br />
				are used across your file
			</p>
			<LogoInverted className="w-32 h-32" />
			<div className="flex flex-col gap-y-1.5 font-sans text-sm text-[#3A3C3F] items-center">
				<p className="flex items-center gap-x-1">
					<Search className="w-4 h-4" />
					<span>Type variable name to search</span>
				</p>
				<p className="flex items-center gap-x-1">
					<LocateFixed className="w-4 h-4" /> <span>Click results to navigate</span>
				</p>
			</div>
		</div>
	);
};

export default Intro;
