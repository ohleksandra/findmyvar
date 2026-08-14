import { createRpcServer, FigmaMainTransport, RpcError } from 'figma-plugin-rpc';
import type { RpcMiddleware } from 'figma-plugin-rpc';
import { z } from 'zod';
import { registerAllHandlers } from './handlers';
import { logger, formatDuration } from '../shared/logger';
import { VariableSearchService } from './services/variableSearchService';
import type { PluginProcedures, PluginNotifications } from '../shared/rpc-types';

const validators: Record<string, z.ZodType> = {
	'variableSearch.start': z.object({
		variableId: z.string().min(1, 'variableId is required'),
		scope: z.enum(['all-pages', 'current-page', 'selection']),
		searchId: z.string().min(1, 'searchId is required'),
	}),
	'variableSearch.clearCache': z
		.object({
			variableId: z.string().optional(),
		})
		.optional(),
	'variableSearch.navigateTo': z.object({
		nodeId: z.string().min(1, 'nodeId is required'),
		pageId: z.string().min(1, 'pageId is required'),
	}),
};

export default function () {
	figma.showUI(__html__, { width: 538, height: 800, themeColors: true });

	const errorNormalizer: RpcMiddleware = async (ctx, next) => {
		try {
			return await next();
		} catch (error) {
			if (error instanceof RpcError) throw error;
			const message = error instanceof Error ? error.message : String(error);
			throw new RpcError('INTERNAL', message);
		}
	};

	const timingThresholdMs = 500;
	const timing: RpcMiddleware = async (ctx, next) => {
		const start = Date.now();
		try {
			return await next();
		} finally {
			const duration = Date.now() - start;
			if (duration > timingThresholdMs) {
				logger.warn(`[RPC] slow ${ctx.procedure} (${formatDuration(duration)})`);
			}
		}
	};

	const validation: RpcMiddleware = async (ctx, next) => {
		const schema = validators[ctx.procedure];
		if (schema) {
			const result = schema.safeParse(ctx.payload);
			if (!result.success) {
				const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
				throw new RpcError('VALIDATION_ERROR', `${ctx.procedure}: ${issues.join(', ')}`, {
					procedure: ctx.procedure,
					issues: result.error.issues,
				});
			}
		}
		return next();
	};

	const rpcServer = createRpcServer<PluginProcedures, PluginNotifications>(
		new FigmaMainTransport(),
		{
			middleware: [errorNormalizer, timing, validation],
			onError: (procedure, error) => {
				logger.error(`[RPC] unhandled error in ${procedure}:`, error);
			},
		},
	);

	const variableSearchService = new VariableSearchService(rpcServer);
	void variableSearchService.init();

	logger.log('[Plugin] Initialized');

	registerAllHandlers(rpcServer, { variableSearchService });
	rpcServer.start();
}
