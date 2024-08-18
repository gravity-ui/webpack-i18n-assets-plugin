import {ArrayPluralValue, KeyValue, ObjectPluralValue, ReplacerContext} from 'src/types';

import {getPluralValues, isArrayPlural, isObjectPlural} from './keyResolver';
import {KEYSET_SEPARATOR} from './keysets';

const MAX_NESTING_DEPTH = 1;
export const getTranslationsRegExp = () => new RegExp(/\$t{([^}]+)}/g);

export const resolveWithNestedTranslations = (
    context: ReplacerContext,
    params: {
        key: string;
        keyset?: string;
        nestingDepth?: number;
    },
) => {
    const {key, keyset, nestingDepth} = params;
    let keyValue = context.resolveKey(key, keyset);

    if (!keyValue) {
        return keyValue;
    }

    const isNested = nestingDepth && nestingDepth > 0;
    if (isNested) {
        if (isArrayPlural(keyValue) || isObjectPlural(keyValue)) {
            return undefined;
        }
    }

    if (isArrayPlural(keyValue)) {
        const isPluralValueHasNestingTranslations = getPluralValues(
            keyValue as ArrayPluralValue | ObjectPluralValue,
        ).some((kv) => hasNestingTranslations(kv));

        if (isPluralValueHasNestingTranslations) {
            return undefined;
        }
    }

    if (typeof keyValue === 'string') {
        const result = resolveNestingKeys(context, {
            keyValue: keyValue as string,
            keyset,
            nestingDepth: nestingDepth ?? 0,
        });

        if (!result) {
            return undefined;
        }

        keyValue = result;
    }

    return keyValue;
};

export const hasNestingTranslations = (keyValue: string): boolean => {
    const NESTING_PREGEXP = getTranslationsRegExp();
    const match = NESTING_PREGEXP.exec(keyValue);
    return (match?.length ?? 0) > 0;
};

const resolveNestingKeys = (
    context: ReplacerContext,
    params: {
        keyValue: string;
        keyset?: string;
        nestingDepth: number;
    },
): KeyValue | undefined => {
    const {keyValue, keyset, nestingDepth} = params;
    let result = '';

    const NESTING_PREGEXP = getTranslationsRegExp();

    let lastIndex = (NESTING_PREGEXP.lastIndex = 0);
    let match;
    while ((match = NESTING_PREGEXP.exec(keyValue))) {
        if (lastIndex !== match.index) {
            result += keyValue.slice(lastIndex, match.index);
        }
        lastIndex = NESTING_PREGEXP.lastIndex;

        const [all, key] = match;
        if (key) {
            if (nestingDepth + 1 > MAX_NESTING_DEPTH) {
                return undefined;
            }

            let [inheritedKey, inheritedKeysetName]: [string, string | undefined] = [
                key,
                undefined,
            ];

            const parts = key.split(KEYSET_SEPARATOR);
            if (parts.length > 1) {
                [inheritedKeysetName, inheritedKey] = [parts[0], parts[1]!];
            }

            if (!inheritedKey) {
                return undefined;
            }

            const nestedKeyValue = resolveWithNestedTranslations(context, {
                key: inheritedKey,
                keyset: inheritedKeysetName ?? keyset,
                nestingDepth: nestingDepth + 1,
            });

            if (!nestedKeyValue) {
                return undefined;
            }

            result += nestedKeyValue;
        } else {
            result += all;
        }
    }

    if (lastIndex < keyValue.length) {
        result += keyValue.slice(lastIndex);
    }

    return result;
};
