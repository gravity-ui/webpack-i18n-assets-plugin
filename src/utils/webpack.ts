import webpack from 'webpack';

export type NormalModuleFactory = Parameters<
    webpack.Compiler['newCompilation']
>[0]['normalModuleFactory'];

export const {
    harmonySpecifierTag,
} = require('webpack/lib/dependencies/HarmonyImportDependencyParserPlugin');

export const {toConstantDependency} = require('webpack/lib/javascript/JavascriptParserHelpers');

export const onOptimizeAssets = (compilation: webpack.Compilation, callback: () => void) => {
    /**
     * Important this this happens before PROCESS_ASSETS_STAGE_OPTIMIZE_HASH, which is where
     * RealContentHashPlugin re-hashes assets:
     * https://github.com/webpack/webpack/blob/f0298fe46f/lib/optimize/RealContentHashPlugin.js#L140
     *
     * PROCESS_ASSETS_STAGE_SUMMARIZE happens after minification
     * (PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE) but before re-hashing
     * (PROCESS_ASSETS_STAGE_OPTIMIZE_HASH).
     *
     * PROCESS_ASSETS_STAGE_SUMMARIZE isn't actually used by Webpack, but there seemed
     * to be other plugins that were relying on it to summarize assets, so it makes sense
     * to run just before that.
     *
     * All "process assets" stages:
     * https://github.com/webpack/webpack/blob/f0298fe46f/lib/Compilation.js#L5125-L5204
     */
    compilation.hooks.processAssets.tap(
        {
            name: 'I18nAssetsPlugin',
            stage: webpack.Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE - 1,
            additionalAssets: true,
        },
        callback,
    );
};

export const deleteAsset = (
    compilation: webpack.Compilation,
    assetName: string,
    newAssetNames: string[],
) => {
    for (const chunk of compilation.chunks) {
        if (chunk.files.has(assetName)) {
            for (const newAssetName of newAssetNames) {
                chunk.files.add(newAssetName);
            }
        }
        if (chunk.auxiliaryFiles.has(assetName)) {
            for (const newAssetName of newAssetNames) {
                chunk.auxiliaryFiles.add(newAssetName);
            }
        }
    }

    compilation.deleteAsset(assetName);
};
