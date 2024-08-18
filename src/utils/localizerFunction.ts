import acorn, {parseExpressionAt} from 'acorn';
import walk from 'acorn-walk';
import type {SimpleCallExpression} from 'estree';
import MagicString from 'magic-string';
import webpack from 'webpack';

import {Options, Replacer} from '../types.js';

import {callReplacer} from './callReplacer';
import {resolveKey} from './keyResolver';
import {parseKeysetKey} from './keysets.js';
import {placeholderFunctionName, placeholderKeysetFunctionName} from './replaceLocalizerCalls.js';

type Location = {
    start: number;
    end: number;
};

type PlaceholderLocation = {
    location: Location;
    code: string;
};

const isPlaceholderFunctionCall = (node: acorn.CallExpression) => {
    if (node.callee.type === 'CallExpression') {
        // (0,ui_utils_i18n/* default */.ZP)(_placeholderI18nFunction)('form.oslogin','field_home-directory')
        if (
            node.callee.arguments.length === 1 &&
            node.callee.arguments[0].type === 'Identifier' &&
            node.callee.arguments[0].name === placeholderFunctionName
        ) {
            return true;
        }

        // (0,l.et)(_placeholderI18nKeysetFunction("common"))("overview")
        if (
            node.callee.arguments.length === 1 &&
            node.callee.arguments[0].type === 'CallExpression' &&
            node.callee.arguments[0].callee.type === 'Identifier' &&
            node.callee.arguments[0].callee.name === placeholderKeysetFunctionName
        ) {
            return true;
        }

        // (_placeholderI18nFunction)("hello-key")
        if (
            node.callee.callee.type === 'CallExpression' &&
            node.callee.callee.arguments.length === 1 &&
            node.callee.callee.arguments[0].type === 'Identifier' &&
            node.callee.callee.arguments[0].name === placeholderFunctionName
        ) {
            return true;
        }

        if (
            node.callee.type === 'CallExpression' &&
            node.callee.callee.type === 'Identifier' &&
            node.callee.callee.name === placeholderKeysetFunctionName &&
            node.callee.arguments.length &&
            node.callee.arguments[0].type === 'Literal'
        ) {
            return true;
        }
    }

    // (_placeholderI18nFunction)('form.oslogin','field_home-directory')
    if (node.callee.type === 'Identifier' && node.callee.name === placeholderFunctionName) {
        return true;
    }

    return false;
};

const locatePlaceholderFunctions = (assetCode: string) => {
    const ast = acorn.parse(assetCode, {ecmaVersion: 'latest'});
    const locations: PlaceholderLocation[] = [];

    walk.simple(ast, {
        CallExpression(node) {
            if (isPlaceholderFunctionCall(node)) {
                const code = assetCode.slice(node.start, node.end);
                locations.push({
                    code,
                    location: {
                        start: node.start,
                        end: node.end,
                    },
                });
            }
        },
    });

    return locations;
};

const unescape = (string: string) => string.replace(/\\(.)/g, '$1');
const escape = (string: string) => JSON.stringify(string).slice(1, -1);
const parseCallExpression = (code: string) => {
    let normalizedCode = code;

    // Call Expression variants:
    // _placeholderI18nKeysetFunction("actions")("hello-key")
    // ((_placeholderI18nKeysetFunction)("actions"))("hello-key")
    // ((_placeholderI18nKeysetFunction)("keyset"))("label_maintenance",{plannedTime:(0,l.nA)((0,l.WW)(s))})
    // _placeholderI18nKeysetFunction("keyset")("label_maintenance",{plannedTime:(0,l.nA)((0,l.WW)(s))})
    if (normalizedCode.includes(placeholderKeysetFunctionName)) {
        normalizedCode = normalizedCode.replace('"))("', '")("');
        const parts = normalizedCode.split('")("');
        // ['_placeholderI18nKeysetFunction("actions', 'hello-key")']
        if (parts.length === 2) {
            // actions
            const keyset = parts[0].split('"')[1];
            // _placeholderI18nFunction("actions::hello-key")
            normalizedCode = `${placeholderFunctionName}("${keyset}::${parts[1]}`;
        } else {
            throw new Error(`Error parse expression ${code}`);
        }
    } else {
        const parts = normalizedCode.split(`${placeholderFunctionName})`);

        if (parts.length === 2) {
            normalizedCode = `${placeholderFunctionName}${parts[1]}`;
        }
    }

    return parseExpressionAt(normalizedCode, 0, {
        ecmaVersion: 'latest',
    });
};

export const createLocalizedStringInserter = (
    assetCode: string,
    compilation: webpack.Compilation,
    replacer: Replacer,
    locales: Options['locales'],
) => {
    const {devtool} = compilation.options;
    const isDevtoolEval = devtool && devtool.includes('eval');
    const placeholderLocations = locatePlaceholderFunctions(assetCode);

    return (ms: MagicString, {locale}: {locale: string}) => {
        /**
            We have to have cash container for nested calls of the i18n function:

            i18n('some-keyset', 'some-key', { // B*
                value: i18n('some-keyset', 'some-key-2') // A*
            })

            // locatePlaceholderFunctions guarantees nested calls before external
            const placeholderLocations = locatePlaceholderFunctions(assetCode); // [A*, B*];

            locatePlaceholderFunctions detects both calls of i18n, but ms.overwrite (and ms.update) overwrites
            the result of parseCallExpression(A*) by parseCallExpression(B*).

            parseCallExpression(B*) substitutes the transletion only for an external i18n call, nested calls are ignored,
            so we want take from the cash all substitutions for nested i18n calls.
        */

        const cash = new Map<string, string>();

        const localeData = locales[locale];
        placeholderLocations.forEach((placeholder) => {
            let code = placeholder.code;

            /**
             * When devtools: 'eval', the entire module is wrapped in an eval("")
             * so double quotes are escaped. For example: __(\\"hello-key\\")
             *
             * The double quotes need to be unescaped for it to be parsable
             */
            // TODO: unsupported eval mode
            if (isDevtoolEval) {
                code = unescape(code);
            }

            cash.forEach((cashedlocalizedCode, cashedCode) => {
                // kind of replaceAll
                code = code.split(cashedCode).join(cashedlocalizedCode);
            });

            let localizedString = code;

            const callNode = parseCallExpression(code);

            if (callNode.type === 'CallExpression') {
                const firstArg = callNode.arguments[0];

                if (firstArg && firstArg.type === 'Literal' && typeof firstArg.value === 'string') {
                    const fullKey = firstArg.value;
                    const {key: parsedKey, keyset: parsedKeyset} = parseKeysetKey(fullKey);

                    const replacerResult = callReplacer(
                        replacer,
                        {
                            localeData,
                            resolveKey: (key = parsedKey, keyset = parsedKeyset) => {
                                return resolveKey({localeData, key, keyset});
                            },
                        },
                        {
                            callNode: callNode as SimpleCallExpression,
                            key: parsedKey,
                            keyset: parsedKeyset,
                            localeName: locale,
                        },
                    );

                    localizedString = replacerResult.value;
                }
            }

            if (isDevtoolEval) {
                // Re-escape before putting it back into eval("")
                localizedString = escape(localizedString);
            }

            cash.set(code, localizedString);
            ms.overwrite(placeholder.location.start, placeholder.location.end, localizedString);
        });
    };
};
