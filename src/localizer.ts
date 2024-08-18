import webpack from 'webpack';

import {DeclarationResolver, ImportResolver, Options, Replacer} from './types';
import {replaceLocaleInAssetName} from './utils/assetName';
import {generateLocalizedAssets} from './utils/generateLocalizedAssets';
import {replaceLocalizerCalls} from './utils/replaceLocalizerCalls';
import {NormalModuleFactory, onOptimizeAssets} from './utils/webpack';

export const runLocalizer = (
    compilation: webpack.Compilation,
    normalModuleFactory: NormalModuleFactory,
    locales: Options['locales'],
    replacer: Replacer,
    importResolver?: ImportResolver,
    declarationResolver?: DeclarationResolver,
    trackUsedKeys?: Set<string>,
) => {
    // Replace localizer function calls to placeholder funciton
    replaceLocalizerCalls(
        normalModuleFactory,
        locales,
        replacer,
        importResolver,
        declarationResolver,
        trackUsedKeys,
    );

    /**
     * The reason why we replace "[locale]" with a placeholder instead of
     * the actual locale is because the name is used to load chunks.
     *
     * That means a file can be loading another file like `load('./file.[locale].js')`.
     * We later localize the assets by search-and-replacing instances of
     * `[locale]` with the actual locale.
     *
     * The placeholder is a unique enough string to guarantee that we're not accidentally
     * replacing `[locale]` if it happens to be in the source JS.
     */
    compilation.hooks.assetPath.tap('I18nAssetsPlugin', replaceLocaleInAssetName(compilation));

    // Create localized assets by swapping out placeholders with localized strings
    onOptimizeAssets(compilation, () => generateLocalizedAssets(compilation, locales, replacer));

    // Update chunkHash based on localized content
    compilation.hooks.chunkHash.tap('I18nAssetsPlugin', (chunk, hash) => {
        const allModules = compilation.chunkGraph.getChunkModules(chunk);

        const localizedModules = allModules
            .map((module) => module.buildInfo?.localized)
            .filter(Boolean);

        if (localizedModules.length > 0) {
            hash.update(JSON.stringify(localizedModules));
        }
    });
};
