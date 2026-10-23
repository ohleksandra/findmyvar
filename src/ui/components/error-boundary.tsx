import { Component, type ReactNode, type ErrorInfo } from 'react';

interface ErrorBoundaryProps {
	children: ReactNode;
	fallback?: ReactNode | ((error: Error, reset: () => void) => ReactNode);
	onError?: (error: Error, info: ErrorInfo) => void;
}

interface ErrorBoundaryState {
	error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { error };
	}

	componentDidCatch(error: Error, info: ErrorInfo): void {
		this.props.onError?.(error, info);
	}

	reset = (): void => {
		this.setState({ error: null });
	};

	render(): ReactNode {
		const { error } = this.state;

		if (error) {
			if (typeof this.props.fallback === 'function') {
				return this.props.fallback(error, this.reset);
			}
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div
					style={{
						display: 'flex',
						flexDirection: 'column',
						alignItems: 'center',
						justifyContent: 'center',
						padding: '24px',
						gap: '12px',
						fontFamily: 'inherit',
					}}
				>
					<p
						style={{
							fontSize: '13px',
							lineHeight: '22px',
							fontWeight: 550,
							color: 'var(--ui3-text, rgba(0, 0, 0, 0.9))',
							margin: 0,
						}}
					>
						Something went wrong
					</p>
					<p
						style={{
							fontSize: '11px',
							lineHeight: '16px',
							color: 'var(--ui3-text-secondary, rgba(0, 0, 0, 0.5))',
							margin: 0,
							textAlign: 'center',
						}}
					>
						{error.message}
					</p>
					<button
						type="button"
						onClick={() => window.location.reload()}
						style={{
							height: '24px',
							padding: '0 8px',
							fontFamily: 'inherit',
							fontSize: '11px',
							fontWeight: 450,
							color: 'var(--ui3-text-onbrand, #fff)',
							backgroundColor: 'var(--ui3-bg-brand, #0d99ff)',
							border: 'none',
							borderRadius: '5px',
						}}
					>
						Reload
					</button>
				</div>
			);
		}

		return this.props.children;
	}
}

export default ErrorBoundary;
