import type { SearchScope, VariableResolvedType } from './rpc-types';

export const SCOPE_ALL_PAGES: SearchScope = 'all-pages';
export const SCOPE_CURRENT_PAGE: SearchScope = 'current-page';
export const SCOPE_SELECTION: SearchScope = 'selection';

export const DEFAULT_SCOPE: SearchScope = SCOPE_ALL_PAGES;

export const VARIABLE_TYPE_BOOLEAN: VariableResolvedType = 'BOOLEAN';
export const VARIABLE_TYPE_FLOAT: VariableResolvedType = 'FLOAT';
export const VARIABLE_TYPE_STRING: VariableResolvedType = 'STRING';
export const VARIABLE_TYPE_COLOR: VariableResolvedType = 'COLOR';
