export interface PluginMessage<T = any> {
	type: string;
	payload?: T;
}
