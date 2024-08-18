import type {Expression, SimpleCallExpression} from 'estree';
import webpack, {WebpackError} from 'webpack';

import type {DeclarationResolver, ImportResolver, Options, Replacer} from '../types';

import {callReplacer} from './callReplacer';
import {resolveKey} from './keyResolver';
import {encodeKeysetKey} from './keysets';
import {NormalModuleFactory, harmonySpecifierTag, toConstantDependency} from './webpack';

const CustomTranslationCallTag = Symbol('CustomTranslationCallTag');

export const placeholderFunctionName = '_placeholderI18nFunction';
export const placeholderKeysetFunctionName = '_placeholderI18nKeysetFunction';

const createCallReplacer = (
    locales: Options['locales'],
    replacer: Replacer,
    trackStringKeys?: Set<string>,
) => {
    return (
        key: string,
        node: SimpleCallExpression,
        parser: webpack.javascript.JavascriptParser,
        keyset?: string,
    ) => {
        const {module} = parser.state;

        // Track used keys for hash
        if (module.buildInfo && !module.buildInfo.localized) {
            module.buildInfo.localized = {};
        }

        if (module.buildInfo) {
            let isFoundNow = false;

            for (const locale of Object.keys(locales)) {
                const localeData = locales[locale];

                const replacerResult = callReplacer(
                    replacer,
                    {
                        localeData: locales[locale],
                        resolveKey: (keyArg = key, keysetArg = keyset) =>
                            resolveKey({localeData, key: keyArg, keyset: keysetArg}),
                    },
                    {
                        callNode: node,
                        key,
                        keyset,
                        localeName: locale,
                    },
                );

                if (typeof replacerResult.value === 'undefined') {
                    const location = node.loc!.start;
                    const functionName =
                        node.callee.type === 'Identifier'
                            ? node.callee.name
                            : 'NOT_FOUND_FUNCTION_NAME';

                    module.addError(
                        new WebpackError(
                            `[I18nAssetsPlugin] Ignoring confusing usage of localization function "${functionName}" in ${module.resource}:${location.line}:${location.column}`,
                        ),
                    );
                }

                const fullKey = encodeKeysetKey({
                    key: replacerResult.key,
                    keyset: replacerResult.keyset,
                });

                if (trackStringKeys) {
                    trackStringKeys.delete(fullKey);
                }

                if (!module.buildInfo.localized[fullKey]) {
                    module.buildInfo.localized[fullKey] = [];
                    isFoundNow = true;
                }

                if (isFoundNow) {
                    module.buildInfo.localized[fullKey].push(replacerResult.value);
                } else {
                    break;
                }
            }
        }

        if (keyset) {
            toConstantDependency(
                parser,
                `((${placeholderKeysetFunctionName})("${keyset}"))`,
            )(node.callee);
        } else {
            toConstantDependency(parser, `(${placeholderFunctionName})`)(node.callee);
        }
    };
};

export const replaceLocalizerCalls = (
    normalModuleFactory: NormalModuleFactory,
    locales: Options['locales'],
    replacer: Replacer,
    importResolver?: ImportResolver,
    declarationResolver?: DeclarationResolver,
    trackUsedKeys?: Set<string>,
) => {
    const replaceCall = createCallReplacer(locales, replacer, trackUsedKeys);

    const parserHandler = (parser: webpack.javascript.JavascriptParser) => {
        // module -> identifier -> keyset
        const functionToKeyset = new Map<string, Map<string, string | undefined> | undefined>();

        if (importResolver) {
            parser.hooks.importSpecifier.tap(
                'I18nAssetsPlugin',
                (_statement, source, exportName, identifierName) => {
                    if (parser.state.module.resource.includes('node_modules')) {
                        return;
                    }

                    const sourceStr = source?.toString();

                    if (!sourceStr) {
                        return;
                    }

                    const result = importResolver(
                        sourceStr,
                        exportName,
                        identifierName,
                        parser.state.module.resource,
                    );

                    if (result?.resolved) {
                        if (!functionToKeyset.has(parser.state.module.resource)) {
                            functionToKeyset.set(parser.state.module.resource, new Map());
                        }
                        functionToKeyset
                            .get(parser.state.module.resource)
                            ?.set(identifierName, result.keyset);
                    }
                },
            );
        }

        if (declarationResolver) {
            parser.hooks.preDeclarator.tap('I18nAssetsPlugin', (node) => {
                if (parser.state.module.resource.includes('node_modules')) {
                    return;
                }

                const result = declarationResolver(node, parser.state.module.resource);

                if (result) {
                    if (!functionToKeyset.has(parser.state.module.resource)) {
                        functionToKeyset.set(parser.state.module.resource, new Map());
                    }
                    functionToKeyset
                        .get(parser.state.module.resource)
                        ?.set(result.functionName, result.keyset);
                }

                if (
                    node.id.type === 'Identifier' &&
                    functionToKeyset.get(parser.state.module.resource)?.has(node.id.name)
                ) {
                    parser.tagVariable(node.id.name, CustomTranslationCallTag);
                }
            });
        }

        const processCall = (node: Expression): void => {
            if (parser.state.current.resource.includes('node_modules')) {
                return;
            }

            if (node.type !== 'CallExpression') {
                return;
            }

            if (
                node.callee.type === 'Identifier' &&
                functionToKeyset.get(parser.state.current.resource)?.has(node.callee.name)
            ) {
                const {module} = parser.state;
                const firstArgument = node.arguments[0];

                // Enforce minimum requirement that first argument is a string
                if (
                    !(
                        node.arguments.length > 0 &&
                        firstArgument.type === 'Literal' &&
                        typeof firstArgument.value === 'string'
                    )
                ) {
                    const location = node.loc!.start;
                    module.addWarning(
                        new WebpackError(
                            `[I18nAssetsPlugin] Ignoring confusing usage of localization function "${node.callee.name}" in ${module.resource}:${location.line}:${location.column}`,
                        ),
                    );
                    return;
                }

                replaceCall(
                    firstArgument.value,
                    node,
                    parser,
                    functionToKeyset.get(parser.state.current.resource)!.get(node.callee.name),
                );
            }
        };

        parser.hooks.call.for(CustomTranslationCallTag).tap('I18nAssetsPlugin', processCall);
        parser.hooks.callMemberChain.for(harmonySpecifierTag).tap('I18nAssetsPlugin', processCall);
    };

    ['javascript/auto', 'javascript/dynamic', 'javascript/esm'].forEach((type) => {
        normalModuleFactory.hooks.parser.for(type).tap('I18nAssetsPlugin', parserHandler);
    });
};
