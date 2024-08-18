import type MagicString from 'magic-string';
import webpack from 'webpack';

import {Options} from '../types';

import {sha256} from './sha256';
import {findSubstringLocations, replaceAll} from './strings';

type Asset = Exclude<ReturnType<webpack.Compilation['getAsset']>, undefined>;

const getAllContentHashes = (assets: Readonly<Asset>[]) =>
    assets.flatMap((asset) => {
        const {contenthash} = asset.info;
        return contenthash ?? [];
    });

export const createHashManager = (assets: Readonly<Asset>[], locales: Options['locales']) => {
    const contentHashes = getAllContentHashes(assets);
    const localizedContentHashes = new Map<string, string>();

    for (const contentHash of contentHashes) {
        for (const locale of Object.keys(locales)) {
            localizedContentHashes.set(
                contentHash + locale,
                sha256(contentHash + locale).slice(0, contentHash.length),
            );
        }
    }

    return {
        insertLocalizedContentHash(
            localizedAssetName: string,
            assetInfo: Asset['info'],
            locale: string,
        ) {
            const {contenthash} = assetInfo;
            if (contenthash) {
                const getLocalizedHash = (hash: string) => {
                    const newContentHash = localizedContentHashes.get(hash + locale) ?? hash;
                    localizedAssetName = replaceAll(localizedAssetName, hash, newContentHash);
                    return newContentHash;
                };

                assetInfo.contenthash = Array.isArray(contenthash)
                    ? contenthash.map(getLocalizedHash)
                    : getLocalizedHash(contenthash);
            }

            return localizedAssetName;
        },

        getHashLocations(sourceString: string) {
            // Find references to content hash to replace with localized content hash
            const contentHashLocations = contentHashes.map(
                (hash) => [hash, findSubstringLocations(sourceString, hash)] as const,
            );

            return (ms: MagicString, {locale}: {locale: string}) => {
                for (const [hash, locations] of contentHashLocations) {
                    const localizedHash = localizedContentHashes.get(hash + locale)!;
                    for (const location of locations) {
                        ms.overwrite(location, location + hash.length, localizedHash);
                    }
                }
            };
        },
    };
};
