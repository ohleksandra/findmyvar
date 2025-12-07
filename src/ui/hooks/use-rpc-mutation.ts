import { callPlugin } from '@/lib/rpc-client';
import type { RpcProcedure, RpcRequest, RpcResponse } from '../../shared/rpc-types';
import { useCallback, useRef, useState } from 'react';

interface RpcMutationState<T> {
	data: T | null;
	isLoading: boolean;
	error: Error | null;
	isSuccess: boolean;
	isError: boolean;
}

interface UseRpcMutationOptions<T> {
	onSuccess?: (data: T) => void;
	onError?: (error: Error) => void;
	onSettled?: () => void;
}

interface UseRpcMutationResult<TProc extends RpcProcedure> {
	mutate: (payload: RpcRequest<TProc>) => void;
	mutateAsync: (payload: RpcRequest<TProc>) => Promise<RpcResponse<TProc>>;
	data: RpcResponse<TProc> | null;
	isLoading: boolean;
	error: Error | null;
	isSuccess: boolean;
	isError: boolean;
	reset: () => void;
}

export function useRpcMutation<T extends RpcProcedure>(
	procedure: T,
	options: UseRpcMutationOptions<RpcResponse<T>> = {},
): UseRpcMutationResult<T> {
	const { onSuccess, onError, onSettled } = options;

	const [state, setState] = useState<RpcMutationState<RpcResponse<T>>>({
		data: null,
		isLoading: false,
		error: null,
		isSuccess: false,
		isError: false,
	});

	const isMountedRef = useRef(true);

	const mutateAsync = useCallback(
		async (payload: RpcRequest<T>): Promise<RpcResponse<T>> => {
			setState({
				data: null,
				isLoading: true,
				error: null,
				isSuccess: false,
				isError: false,
			});

			try {
				const response = await callPlugin(procedure, payload);

				if (isMountedRef.current) {
					setState({
						data: response,
						isLoading: false,
						error: null,
						isSuccess: true,
						isError: false,
					});
				}

				onSuccess?.(response);
				onSettled?.();

				return response;
			} catch (err) {
				const error = err instanceof Error ? err : new Error(String(err));

				if (isMountedRef.current) {
					setState({
						data: null,
						isLoading: false,
						error,
						isSuccess: false,
						isError: true,
					});
				}

				onError?.(error);
				onSettled?.();

				throw error;
			}
		},
		[procedure, onSuccess, onError, onSettled],
	);

	const mutate = useCallback(
		(payload: RpcRequest<T>) => {
			mutateAsync(payload).catch(() => {
				// Error handling is done in mutateAsync
			});
		},
		[mutateAsync],
	);

	const reset = useCallback(() => {
		setState({
			data: null,
			isLoading: false,
			error: null,
			isSuccess: false,
			isError: false,
		});
	}, []);

	return {
		mutate,
		mutateAsync,
		data: state.data,
		isLoading: state.isLoading,
		error: state.error,
		isSuccess: state.isSuccess,
		isError: state.isError,
		reset,
	};
}
