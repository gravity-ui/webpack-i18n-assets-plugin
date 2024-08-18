import webpack from 'webpack';
import {RawSource} from 'webpack-sources';

import type {LocaleData} from '../types';

import {isArrayPlural, isObjectPlural} from './keyResolver';
import {KEYSET_SEPARATOR} from './keysets';

export type StringKeysCollection = Set<string>;

function getKeys(input: LocaleData) {
    let allKeys: StringKeysCollection = new Set();

    Object.keys(input).forEach((key) => {
        const value = input[key];

        if (typeof value === 'string' || isArrayPlural(value) || isObjectPlural(value)) {
            allKeys.add(key);
            return;
        }

        const keysetKeys = [...getKeys(value)].map(
            (valueKey) => `${key}${KEYSET_SEPARATOR}${valueKey}`,
        );
        allKeys = new Set([...allKeys, ...keysetKeys]);
    });

    return allKeys;
}

function getAllKeys(locales: Record<string, LocaleData>) {
    let allStringKeys: StringKeysCollection = new Set();

    Object.keys(locales).forEach((localeName) => {
        const localeData = locales[localeName];
        allStringKeys = new Set([...allStringKeys, ...getKeys(localeData)]);
    });

    return allStringKeys;
}

export const collectUnusedKeys = (
    compilation: webpack.Compilation,
    locales: Record<string, LocaleData>,
) => {
    const unusedKeys = getAllKeys(locales);

    compilation.hooks.afterSeal.tap('I18nAssetsPlugin', () => {
        if (unusedKeys.size === 0) {
            return;
        }

        const result = JSON.stringify([...unusedKeys]);

        // @ts-ignore Outdated @type
        compilation.assets['unused-keys.json'] = new RawSource(result);
    });

    return unusedKeys;
};
