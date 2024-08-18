import type {SimpleCallExpression, VariableDeclarator} from 'estree';

export type ArrayPluralValue = string[];

export type ObjectPluralValue = {
    zero?: string;
    one?: string;
    two?: string;
    few?: string;
    many?: string;
    other?: string;
};

export type KeyValue = string | ArrayPluralValue | ObjectPluralValue;
export type Keyset = Record<string, KeyValue>;
export type LocaleData = Record<string, KeyValue | Keyset>;

export type ImportResolver = (
    source: string,
    exportName: string,
    identifierName: string,
    module: string,
) =>
    | {
          resolved: boolean;
          keyset?: string;
      }
    | undefined;

export type DeclarationResolver = (
    node: VariableDeclarator,
    module: string,
) =>
    | {
          functionName: string;
          keyset?: string;
      }
    | undefined;

export interface ReplacerContext {
    resolveKey(key: string, keyset?: string): KeyValue | undefined;
    localeData: LocaleData;
}

export type ReplacerArgs = {
    callNode: SimpleCallExpression;
    callArguments: string[];
    localeName: string;
    key: string;
    keyset?: string;
};

export type ReplacerResult = string | {value: string; key: string; keyset?: string};

export type Replacer = (this: ReplacerContext, args: ReplacerArgs) => ReplacerResult;

export type Options = {
    locales: Record<string, LocaleData>;
    importResolver?: ImportResolver;
    declarationResolver?: DeclarationResolver;
    replacer?: Replacer;
    collectUnusedKeys?: boolean;
};

export function validateOptions(options: Options) {
    if (!options) {
        throw new Error('Options are required');
    }
    if (!options.locales) {
        throw new Error('Locales are required');
    }
    if (Object.keys(options.locales).length === 0) {
        throw new Error('locales must contain at least one locale');
    }

    const customFunctions = [options.declarationResolver, options.importResolver, options.replacer];
    const enabledCustomFunctionsCount = customFunctions.filter(Boolean).length;

    if (enabledCustomFunctionsCount && enabledCustomFunctionsCount !== customFunctions.length) {
        throw new Error(
            'If you use custom functions, you need to pass all these functions: declarationResolver, importResolver, replacer.',
        );
    }
}
