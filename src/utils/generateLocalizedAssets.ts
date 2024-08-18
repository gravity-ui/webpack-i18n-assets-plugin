import remapping, {SourceMapInput as SourceMapInputBase} from '@ampproject/remapping';
import MagicString, {SourceMap} from 'magic-string';
import type {RawSourceMap} from 'source-map';
import webpack from 'webpack';
import {RawSource, SourceAndMapResult} from 'webpack-sources';

import {Options, Replacer} from '../types';

import {
    assetNamePlaceholder,
    createLocalizedAssetNameInserter,
    localizeAssetName,
} from './assetName';
import {createHashManager} from './contentHash';
import {createLocalizedStringInserter} from './localizerFunction';
import {deleteAsset} from './webpack';

type SourceBase = {
    name: string;
    code: string;
};

type SourceMapInput = Exclude<SourceMapInputBase, string>;

function mergeSourceMap(inputMap: SourceMapInput, map: SourceMapInput): SourceMap {
    const source = map.sources[0] as string;

    // Prevent an infinite recursion if one of the input map's sources has the
    // same resolved path as the input map. In the case, it would keep find the
    // input map, then get it's sources which will include a path like the input
    // map, on and on.
    let found = false;
    const result = remapping(rootless(map), (s, ctx) => {
        if (s === source && !found) {
            found = true;
            // We empty the source location, which will prevent the sourcemap from
            // becoming relative to the input's location. Eg, if we're transforming a
            // file 'foo/bar.js', and it is a transformation of a `baz.js` file in the
            // same directory, the expected output is just `baz.js`. Without this step,
            // it would become `foo/baz.js`.
            ctx.source = '';

            return rootless(inputMap);
        }

        return null;
    });

    if (typeof inputMap.sourceRoot === 'string') {
        result.sourceRoot = inputMap.sourceRoot;
    }

    return {...result} as unknown as SourceMap;
}

function rootless(map: SourceMapInput): SourceMapInput {
    return {
        ...map,

        // This is a bit hack. Remapping will create absolute sources in our
        // sourcemap, but we want to maintain sources relative to the sourceRoot.
        // We'll re-add the sourceRoot after remapping.
        // @ts-ignore
        sourceRoot: null,
    };
}

const transformAsset = <Source extends SourceBase>(
    source: Source,
    transformations: ((magicStringInstance: MagicString, source: Source) => void)[],
) => {
    const magicStringInstance = new MagicString(source.code);

    for (const transformer of transformations) {
        transformer(magicStringInstance, source);
    }

    const transformedCode = magicStringInstance.toString();
    let generatedSourceMap: SourceMap | undefined = magicStringInstance.generateMap({
        file: source.name,
        source: source.name,
        includeContent: true,
        hires: true,
    });

    if (!generatedSourceMap.mappings.length) {
        generatedSourceMap = undefined;
    }

    return {
        source: new RawSource(transformedCode),
        generatedSourceMap,
    };
};

const isJsFile = /\.js$/;
const isSourceMap = /\.js\.map$/;

type NewSourceMapAsset = {
    name: string;
    map: SourceMap;
};

export const generateLocalizedAssets = (
    compilation: webpack.Compilation,
    locales: Options['locales'],
    replacer: Replacer,
) => {
    const assets = compilation
        .getAssets()
        .filter((asset) => asset.name.includes(assetNamePlaceholder));

    const newSourceMaps: Record<string, Record<string, NewSourceMapAsset>> = {};

    const hashManager = createHashManager(assets, locales);

    for (const asset of assets) {
        const sourceMap = asset.source.sourceAndMap() as SourceAndMapResult;
        const source = sourceMap.source;
        let map = sourceMap.map;
        let oldSourceMapName: string | undefined;

        if (!map) {
            const mapAsset = compilation.assets[`${asset.name}.map`];
            if (mapAsset) {
                map = JSON.parse(mapAsset.source().toString()) as RawSourceMap;
                oldSourceMapName = `${asset.name}.map`;
            }
        }

        const localizedAssetNames: string[] = [];

        if (isJsFile.test(asset.name)) {
            const code = source.toString();
            const insertLocalizedStrings = createLocalizedStringInserter(
                code,
                compilation,
                replacer,
                locales,
            );
            const insertLocalizedAssetName = createLocalizedAssetNameInserter(code);
            const insertLocalizedContentHash = hashManager.getHashLocations(code);

            for (const locale of Object.keys(locales)) {
                let localizedAssetName = localizeAssetName(asset.name, locale);

                const newInfo = {
                    ...asset.info,
                    locale,
                };

                // Add locale to hash for RealContentHashPlugin plugin
                localizedAssetName = hashManager.insertLocalizedContentHash(
                    localizedAssetName,
                    newInfo,
                    locale,
                );

                localizedAssetNames.push(localizedAssetName);

                const {source: sourceAfterTransform, generatedSourceMap} = transformAsset(
                    {
                        name: localizedAssetName,
                        code,
                        locale,
                    },
                    [insertLocalizedStrings, insertLocalizedAssetName, insertLocalizedContentHash],
                );

                compilation.emitAsset(
                    localizedAssetName,
                    // @ts-ignore Outdated @type
                    sourceAfterTransform,
                    newInfo,
                );

                if (generatedSourceMap && oldSourceMapName) {
                    if (!newSourceMaps[oldSourceMapName]) {
                        newSourceMaps[oldSourceMapName] = {};
                    }
                    newSourceMaps[oldSourceMapName][locale] = {
                        name: `${localizedAssetName}.map`,
                        map: generatedSourceMap,
                    };
                }
            }
        } else {
            for (const locale of Object.keys(locales)) {
                const newAssetName = localizeAssetName(asset.name, locale);

                if (isSourceMap.test(asset.name) && newSourceMaps[asset.name]?.[locale]) {
                    const {name: newSourceMapName, map: generatedMapByReplacer} =
                        newSourceMaps[asset.name][locale];

                    localizedAssetNames.push(newSourceMapName);

                    const generatedMapByWebpack = JSON.parse(
                        asset.source.source().toString(),
                    ) as SourceMap;

                    const mergedSourceMap = mergeSourceMap(
                        generatedMapByWebpack as SourceMapInput,
                        generatedMapByReplacer as SourceMapInput,
                    );
                    compilation.emitAsset(
                        newSourceMapName,
                        // @ts-ignore Outdated @type
                        new RawSource(JSON.stringify(mergedSourceMap)),
                        asset.info,
                    );
                } else {
                    localizedAssetNames.push(newAssetName);
                    compilation.emitAsset(newAssetName, asset.source, asset.info);
                }
            }
        }

        // Delete original unlocalized asset
        deleteAsset(compilation, asset.name, localizedAssetNames);
    }
};
