import {ArrayPluralValue, KeyValue, Keyset, LocaleData, ObjectPluralValue} from '../types';

import {encodeKeysetKey} from './keysets';

const pluralForms = new Set(['few', 'many', 'one', 'other', 'two', 'zero']);

export const isArrayPlural = (value: KeyValue | Keyset): value is ArrayPluralValue => {
    return Array.isArray(value);
};

export const isObjectPlural = (value: KeyValue | Keyset): value is ObjectPluralValue => {
    if (Array.isArray(value) || typeof value !== 'object') {
        return false;
    }

    const keys = Object.keys(value);

    if (keys.length > pluralForms.size) {
        return false;
    }

    return !keys.some((key) => !pluralForms.has(key));
};

export const getPluralValues = (value: ArrayPluralValue | ObjectPluralValue): string[] => {
    if (value instanceof Array) {
        return value;
    } else if (value instanceof Object) {
        return Object.values(value);
    }

    return [];
};

export const isKeyValue = (value: KeyValue | Keyset): value is KeyValue => {
    return typeof value === 'string' || isArrayPlural(value) || isObjectPlural(value);
};

export const resolveKey = ({
    localeData,
    key,
    keyset,
}: {
    localeData: LocaleData;
    key: string;
    keyset?: string;
}): KeyValue | undefined => {
    const fullKey = encodeKeysetKey({key, keyset});
    let value = localeData[fullKey];

    if (keyset && typeof value === 'undefined') {
        const keysetData = localeData[keyset];

        if (isKeyValue(keysetData)) {
            return undefined;
        }

        value = keysetData[key];
    }

    if (isKeyValue(value)) {
        return value;
    }

    return undefined;
};
