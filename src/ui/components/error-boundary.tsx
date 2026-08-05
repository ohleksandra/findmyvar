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
						fontFamily: 'system-ui, sans-serif',
					}}
				>
					<p
						style={{
							fontSize: '14px',
							fontWeight: 600,
							color: '#17181A',
							margin: 0,
						}}
					>
						Something went wrong
					</p>
					<p
						style={{
							fontSize: '12px',
							color: '#656B75',
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
							padding: '6px 16px',
							fontSize: '12px',
							fontWeight: 500,
							color: '#fff',
							backgroundColor: '#0D99FF',
							border: 'none',
							borderRadius: '6px',
							cursor: 'pointer',
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
