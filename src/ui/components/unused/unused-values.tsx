import type { VariableChain } from '../../../shared/rpc-types';

// Figma truncates alias names from the left ("…and/100"), so the end stays readable.
const LEFT_TRUNCATE = 'overflow-hidden text-ellipsis whitespace-nowrap [direction:rtl] text-left';
const LTR_MARK = '‎';

// A shade darker than the details panel, so values read as tags rather than inputs.
const CHIP = 'inline-flex h-6 items-center gap-x-1.5 rounded-md px-1.5 bg-tertiary';

const Swatch = ({ color }: { color: string }) => (
	<span
		className="size-3.5 shrink-0 rounded-[3px] border border-border-translucent"
		style={{ background: color }}
		aria-hidden="true"
	/>
);

const ValueField = ({ chain }: { chain: VariableChain }) => {
	// Like Figma's editor, show what this variable points to directly; the raw value if it doesn't.
	const alias = chain.steps[1]?.name;
	const text = alias ?? chain.value;
	const fullChain = [...chain.steps.map((s) => s.name), chain.value].join(' → ');

	return (
		<span className={`${CHIP} min-w-0 max-w-full`} title={fullChain}>
			{chain.color && <Swatch color={chain.color} />}
			<span className={`min-w-0 ${alias ? LEFT_TRUNCATE : 'truncate'}`}>
				{alias ? `${LTR_MARK}${text}${LTR_MARK}` : text}
			</span>
			{alias && <span className="shrink-0 text-muted-foreground">{chain.value}</span>}
		</span>
	);
};

/** The variable's value in every mode, laid out like Figma's variable editor. */
const UnusedValues = ({ chains }: { chains: VariableChain[] }) => {
	const rows = chains.flatMap((chain) => chain.modes.map((mode) => ({ mode, chain })));

	return (
		<div className="flex flex-col gap-y-1">
			<p className="font-strong">Values</p>
			{rows.map(({ mode, chain }) => (
				<div key={mode} className="flex items-center gap-x-2">
					<span className="w-24 shrink-0 truncate text-muted-foreground" title={mode}>
						{mode}
					</span>
					<span className="flex min-w-0 items-center gap-x-1">
						<ValueField chain={chain} />
						{chain.opacity !== null && (
							<span className={`${CHIP} shrink-0`}>{chain.opacity}%</span>
						)}
					</span>
				</div>
			))}
		</div>
	);
};

export default UnusedValues;
