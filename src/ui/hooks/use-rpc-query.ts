import { useCallback, useEffect, useRef, useState } from 'react';
import type { RpcProcedure, RpcRequest, RpcResponse } from '../../shared/rpc-types';
import { callPlugin } from '@/lib/rpc-client';

interface RpcQueryState<T> {
	data: T | null;
	isLoading: boolean;
	error: Error | null;
}

interface UseRpcQueryOptions {
	enabled?: boolean;
	timeout?: number;
	onSuccess?: (data: unknown) => void;
	onError?: (error: Error) => void;
}

interface UseRpcQueryResult<T> extends RpcQueryState<T> {
	refetch: () => Promise<void>;
	reset: () => void;
}

export function useRpcQuery<T extends RpcProcedure>(
	procedure: T,
	payload: RpcRequest<T>,
	options: UseRpcQueryOptions = {},
): UseRpcQueryResult<RpcResponse<T>> {
	const { enabled = true, timeout, onSuccess, onError } = options;

	const [state, setState] = useState<RpcQueryState<RpcResponse<T>>>({
		data: null,
		isLoading: enabled,
		error: null,
	});

	const isMountedRef = useRef(true);
	const abortControllerRef = useRef<AbortController | null>(null);

	const payloadKet = JSON.stringify(payload);

	const fetchData = useCallback(async () => {
		abortControllerRef.current?.abort();
		abortControllerRef.current = new AbortController();

		setState((prevState) => ({
			...prevState,
			isLoading: true,
			error: null,
		}));

		try {
			const response = await callPlugin(procedure, payload, { timeout });

			if (!isMountedRef.current) return;

			setState({
				data: response,
				isLoading: false,
				error: null,
			});

			onSuccess?.(response);
		} catch (err) {
			if (err instanceof Error && err.name === 'AbortError') return;
			if (!isMountedRef.current) return;

			const error = err instanceof Error ? err : new Error(String(err));

			setState((prevState) => ({
				...prevState,
				isLoading: false,
				error,
			}));

			onError?.(error);
		}
	}, [procedure, payloadKet, timeout, onSuccess, onError]);

	const reset = useCallback(() => {
		abortControllerRef.current?.abort();
		setState({
			data: null,
			isLoading: enabled,
			error: null,
		});
	}, []);

	useEffect(() => {
		isMountedRef.current = true;

		if (enabled) {
			fetchData();
		}

		return () => {
			isMountedRef.current = false;
			abortControllerRef.current?.abort();
		};
	}, [enabled, fetchData]);

	return {
		...state,
		refetch: fetchData,
		reset,
	};
}
