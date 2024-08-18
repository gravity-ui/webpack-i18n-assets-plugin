import assert from 'assert';

import MagicString from 'magic-string';
import webpack from 'webpack';

import {sha256} from './sha256';
import {findSubstringLocations, replaceAll} from './strings';

export const assetNamePlaceholder = `[locale:${sha256('locale-placeholder').slice(0, 8)}]`;

export const replaceLocaleInAssetName = (compilation: webpack.Compilation) => {
    const {filename, chunkFilename} = compilation.outputOptions;

    if (typeof filename === 'string') {
        assert(filename.includes('[locale]'), 'output.filename must include [locale]');
    }

    if (typeof chunkFilename === 'string') {
        assert(chunkFilename.includes('[locale]'), 'output.chunkFilename must include [locale]');
    }

    return (filePath: string) => {
        return replaceAll(filePath, '[locale]', assetNamePlaceholder);
    };
};

export const localizeAssetName = (assetName: string, locale: string) =>
    replaceAll(assetName, assetNamePlaceholder, locale);

export const createLocalizedAssetNameInserter = (sourceString: string) => {
    const fileNamePlaceholderLocations = findSubstringLocations(sourceString, assetNamePlaceholder);

    return (ms: MagicString, {locale}: {locale: string}) => {
        for (const location of fileNamePlaceholderLocations) {
            ms.overwrite(location, location + assetNamePlaceholder.length, locale);
        }
    };
};
