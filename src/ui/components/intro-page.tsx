import Logo from './icons/logo';
import SearchControl from './search-control';

const IntroPage = () => {
	const href = window.location.href;

	console.log('Current URL:', href);

	return (
		<div className="h-dvh w-full flex flex-col px-8">
			<Logo width={110} height={110} />
			<h1>Find my var</h1>
			<p>Find where variables are used across your file</p>
			<ul>
				<li>🔍 Search for any variable name</li>
				<li>📍 Navigate directly to usage locations</li>
				<li>📊 See usage counts per page</li>
			</ul>
			<SearchControl />
		</div>
	);
};

export default IntroPage;
