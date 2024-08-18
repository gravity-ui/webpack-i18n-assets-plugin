import type {
    CallExpression,
    Expression,
    ObjectExpression,
    Property,
    SpreadElement,
    VariableDeclarator,
} from 'estree';

import {ArrayPluralValue, ObjectPluralValue, ReplacerArgs, ReplacerContext} from '../types';
import {isArrayPlural, isObjectPlural} from '../utils/keyResolver';
import {KEYSET_SEPARATOR} from '../utils/keysets';
import {resolveWithNestedTranslations} from '../utils/nestedKeyResolver';
import {stringifyAstNode} from '../utils/stringifyAstNode';

const isI18nBind = (expr: Expression): expr is CallExpression =>
    expr.type === 'CallExpression' &&
    expr.callee.type === 'MemberExpression' &&
    expr.callee.object.type === 'Identifier' &&
    expr.callee.object.name === 'i18n' &&
    expr.callee.property.type === 'Identifier' &&
    expr.callee.property.name === 'bind';

const getKeysetFromBind = (expr: CallExpression) => {
    if (
        expr.arguments.length === 2 &&
        expr.arguments[1].type === 'Literal' &&
        typeof expr.arguments[1].value === 'string'
    ) {
        return expr.arguments[1].value;
    }

    throw new Error('Incorrect args count in i18n bind');
};

export const declarationResolver = (declarator: VariableDeclarator) => {
    if (
        declarator.id.type === 'Identifier' &&
        declarator.id.name.startsWith('i18n') &&
        declarator.init &&
        isI18nBind(declarator.init)
    ) {
        return {
            functionName: declarator.id.name,
            keyset: getKeysetFromBind(declarator.init),
        };
    }

    return undefined;
};

const PARAM_REGEXP = /{{(.*?)}}/g;

const replaceParamsInString = (input: string, origParams: ObjectExpression) => {
    const params = origParams.properties.reduce<Record<string, string>>((acc, prop) => {
        if (prop.type === 'Property' && prop.key.type === 'Identifier') {
            return {
                ...acc,
                [prop.key.name]: stringifyAstNode(prop.value),
            };
        }

        if (prop.type === 'Property' && prop.key.type === 'Literal') {
            return {
                ...acc,
                [String(prop.key.value)]: stringifyAstNode(prop.value).replaceAll('`', '\\`'),
            };
        }

        return acc;
    }, {});

    let hasReplacements = false;
    let result = '';
    let lastIndex = (PARAM_REGEXP.lastIndex = 0);
    let match;
    while ((match = PARAM_REGEXP.exec(input))) {
        if (lastIndex !== match.index) {
            result += input.slice(lastIndex, match.index);
        }
        lastIndex = PARAM_REGEXP.lastIndex;

        const [all, key] = match;
        if (key && Object.prototype.hasOwnProperty.call(params, key)) {
            result += `$\{${params[key]}}`;
            hasReplacements = true;
        } else {
            result += all;
        }
    }
    if (lastIndex < input.length) {
        result += input.slice(lastIndex);
    }

    if (hasReplacements) {
        return '`' + result + '`';
    }

    return result;
};

const convertObjToString = (obj: Record<string, string>) => {
    let result = '{';
    let hasAnyKey = false;
    Object.entries(obj).forEach(([keyArg, value]) => {
        if (hasAnyKey) {
            result += ',';
        }
        result += `"${keyArg}":` + (value[0] === '`' ? value : JSON.stringify(value));
        hasAnyKey = true;
    });
    result += '}';
    return result;
};

// eslint-disable-next-line complexity
const keepOnlyRequiredPluralForms = (
    value: ObjectPluralValue,
    locale: string,
): ObjectPluralValue => {
    if (locale === 'ru') {
        return {
            zero: value.zero || '',
            one: value.one || '',
            few: value.few || '',
            many: value.many || '',
        };
    } else if (locale === 'en') {
        return {
            zero: value.zero || '',
            one: value.one || '',
            other: value.other || value.few || value.many || '',
        };
    } else if (locale === 'es') {
        return {
            zero: value.zero || '',
            one: value.one || '',
            other: value.other || value.few || value.many || '',
        };
    } else if (locale === 'ja') {
        return {
            zero: value.zero || '',
            other: value.other || value.few || value.many || '',
        };
    }

    throw new Error(`Unsupported language '${locale}' in plurals`);
};

const convertArrayPluralsToObjectFormat = (values: string[], locale: string): ObjectPluralValue => {
    if (locale === 'ru') {
        return {
            zero: values[3],
            one: values[0],
            few: values[1],
            many: values[2],
        };
    } else if (locale === 'en') {
        return {
            zero: values[3],
            one: values[0],
            other: values[1] || values[2],
        };
    } else if (locale === 'es') {
        return {
            zero: values[3],
            one: values[0],
            other: values[1] || values[2],
        };
    } else if (locale === 'ja') {
        return {
            zero: values[3],
            other: values[1] || values[2],
        };
    }

    throw new Error(`Unsupported language '${locale}' in plurals`);
};

const makePluralFunc = (
    locale: string,
    values: ArrayPluralValue | ObjectPluralValue,
    params: ObjectExpression,
) => {
    // pseudo-locales can be with regions ru-ru, en-ru, etc.
    const localeNormalized = locale.split('-')[0];

    const paramsWithoutCount: ObjectExpression = {
        ...params,
        properties: params.properties.filter(
            (p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name !== 'count',
        ),
    };

    let intlPluralForms = Array.isArray(values)
        ? convertArrayPluralsToObjectFormat(values, localeNormalized)
        : values;

    intlPluralForms = keepOnlyRequiredPluralForms(intlPluralForms, localeNormalized);

    Object.keys(intlPluralForms).forEach((key) => {
        const pluralKey = key as keyof ObjectPluralValue;
        if (intlPluralForms[pluralKey]) {
            intlPluralForms[pluralKey] = replaceParamsInString(
                intlPluralForms[pluralKey] || '',
                paramsWithoutCount,
            );
        }
    });

    const countProp = params.properties.find(
        (p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'count',
    ) as Property;
    const count = stringifyAstNode(countProp.value);

    return `(function(f,c){
        const v=f[!c ? "zero" : new Intl.PluralRules("${localeNormalized}").select(c)];
        return v && v.replaceAll("{{count}}",c);
    })(${convertObjToString(intlPluralForms)}, ${count})`;
};

export function replacer(
    this: ReplacerContext,
    {callNode, key: parsedKey, keyset: parsedKeyset, localeName}: ReplacerArgs,
) {
    let key = parsedKey;
    let keyset = parsedKeyset;
    let params: Expression | SpreadElement | undefined;

    const getStringValue = (node: Expression | SpreadElement) => {
        if (node.type === 'Literal' && typeof node.value === 'string') {
            return node.value;
        }

        throw new Error(
            `Incorrect argument type in localizer call [key = '${key}', keyset = '${keyset}']`,
        );
    };

    // call with one key i18nK('key')
    if (callNode.arguments.length === 1) {
        key = getStringValue(callNode.arguments[0]);
    } else if (callNode.arguments.length === 2) {
        // i18n('keyset', 'key') or i18nK('key', {params})
        const [firstArg, secondArg] = callNode.arguments;

        if (secondArg.type === 'Literal') {
            keyset = getStringValue(firstArg);
            key = getStringValue(secondArg);
        } else {
            key = getStringValue(firstArg);
            params = secondArg;
        }
    } else if (callNode.arguments.length === 3) {
        // i18n(namespace, key, params)
        const [firstArg, secondArg, thirdArg] = callNode.arguments;
        keyset = getStringValue(firstArg);
        key = getStringValue(secondArg);
        params = thirdArg;
    } else {
        throw new Error(
            `Incorrect count of arguments in localizer call [key = '${key}', keyset = '${keyset}']`,
        );
    }

    const keyParts = key.split(KEYSET_SEPARATOR);
    if (keyParts.length === 2) {
        key = keyParts[1];
    }

    if (params && params.type !== 'ObjectExpression') {
        throw new Error(`Incorrect params type [key = '${key}', keyset = '${keyset}']`);
    }

    const hasCountParam =
        params &&
        params.type === 'ObjectExpression' &&
        params.properties.some(
            (p) => p.type === 'Property' && p.key.type === 'Identifier' && p.key.name === 'count',
        );

    const value = resolveWithNestedTranslations(this, {
        key,
        keyset,
    });

    if (typeof value === 'undefined') {
        throw new Error(
            `Not found key value [key = '${key}', keyset = '${keyset}', locale = ${localeName}]`,
        );
    }

    // plural
    if (isArrayPlural(value) || isObjectPlural(value)) {
        if (!hasCountParam) {
            throw new Error(
                `Not found count param in plural call [key = '${key}', keyset = '${keyset}']`,
            );
        }

        return {
            value: makePluralFunc(localeName, value, params as ObjectExpression),
            key,
            keyset,
        };
    }

    if (params) {
        const val = replaceParamsInString(value, params as ObjectExpression);

        return {
            value: val[0] === '`' ? val : JSON.stringify(val),
            key,
            keyset,
        };
    }

    return {
        value: JSON.stringify(value),
        key,
        keyset,
    };
}

export const importResolver = (source: string, exportName: string) => {
    // import i18n from 'ui/utils/i18n'
    // import {i18n} from 'ui/utils/i18n'
    if (source === 'ui/utils/i18n' && (exportName === 'default' || exportName === 'i18n')) {
        return {
            resolved: true,
            keyset: undefined,
        };
    }

    return undefined;
};
