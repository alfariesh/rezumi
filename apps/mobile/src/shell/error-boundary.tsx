import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

type ErrorBoundaryProps = {
	children: ReactNode;
	fallback: (props: { resetError: () => void }) => ReactNode;
};

type ErrorBoundaryState = { failed: boolean };

/** Keeps one broken screen from taking the whole app down; the fallback offers a retry. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
	override state: ErrorBoundaryState = { failed: false };

	static getDerivedStateFromError(): ErrorBoundaryState {
		return { failed: true };
	}

	override componentDidCatch(error: Error, info: ErrorInfo) {
		// Crash reporting (EAS Observe) is off until the owner has an Expo project; keep the trace in device logs.
		console.error(error, info.componentStack);
	}

	resetError = () => this.setState({ failed: false });

	override render() {
		return this.state.failed ? this.props.fallback({ resetError: this.resetError }) : this.props.children;
	}
}
