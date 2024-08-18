import {expect, testSuite} from 'manten';
import {build} from 'webpack-test-utils';

import {I18nAssetsPlugin} from '../../src';
import {localesMulti} from '../utils/localization-data.js';

export default testSuite(({describe}) => {
    describe('contenthash', ({test}) => {
        test('async chunks', async () => {
            const built = await build(
                {
                    '/src/index.js':
                        'export default import("./async-import").then(module => module.default);',
                    '/src/async-import.js':
                        'export default import("./async-import2").then(module => module.default);',
                    '/src/async-import2.js': `
                    import {i18n} from "./utils";
                    const i18nK = i18n.bind(null, "actions");
                    export default i18nK("hello-key");
                    `,
                    '/src/utils.js': 'export const i18n = (keyset, key) => keyset + key;',
                },
                (config) => {
                    config.output!.filename = '[name].[contenthash].[locale].js';

                    config.plugins!.push(
                        new I18nAssetsPlugin({
                            locales: localesMulti,
                        }),
                    );
                },
            );

            const assets = Object.keys(built.stats.compilation.assets);
            const indexAsset = assets.find((a) => a.includes('index') && a.includes('.en.js'));

            expect(await built.require(`/dist/${indexAsset}`)).toBe(
                localesMulti.en.actions['hello-key'],
            );
        });

        test('check contenthash', async () => {
            const volume = {
                '/src/utils.js': 'export const i18n = (keyset, key) => keyset + key;',
                '/src/index.js': `
                import {i18n} from "./utils";
                const i18nK = i18n.bind(null, "actions");
                export default i18nK("hello-key");
                `,
            };

            const builtA = await build(volume, (config) => {
                config.output!.filename = '[name].[contenthash].[locale].js';
                config.plugins!.push(
                    new I18nAssetsPlugin({
                        locales: localesMulti,
                    }),
                );
            });

            const assetsA = Object.keys(builtA.stats.compilation.assets);
            const [assetFilenameA] = assetsA;

            const enBuildA = builtA.require(`/dist/${assetFilenameA}`);
            expect(enBuildA).toBe('Привет');

            const builtB = await build(volume, (config) => {
                config.output!.filename = '[name].[contenthash].[locale].js';
                config.plugins!.push(
                    new I18nAssetsPlugin({
                        locales: {
                            ...localesMulti,
                            ru: {
                                ...localesMulti.ru,
                                actions: {
                                    ...localesMulti.en.actions,
                                    'hello-key': 'Здравствуйте',
                                },
                            },
                        },
                    }),
                );
            });

            const assetsB = Object.keys(builtB.stats.compilation.assets);
            const [assetFilenameB] = assetsB;

            const enBuildB = builtB.require(`/dist/${assetFilenameB}`);
            expect(enBuildB).toBe('Здравствуйте');

            expect(assetFilenameA).not.toBe(assetFilenameB);
            expect(assetsB[1]).toBe(assetsA[1]);
        });

        test('identical names of source map and chunks', async () => {
            const built = await build(
                {
                    '/src/index.js':
                        'export default import("./async-import").then(module => module.default);',
                    '/src/async-import.js':
                        'export default import("./async-import2").then(module => module.default);',
                    '/src/async-import2.js': `
                import {i18n} from "./utils";
                const i18nK = i18n.bind(null, "actions");
                export default i18nK("hello-key");
                `,
                    '/src/utils.js': 'export const i18n = (keyset, key) => keyset + key;',
                },
                (config) => {
                    config.devtool = 'source-map';
                    config.output!.filename = '[name].[contenthash:8].[locale].js';

                    config.plugins!.push(
                        new I18nAssetsPlugin({
                            locales: localesMulti,
                        }),
                    );
                },
            );

            const assets = Object.keys(built.stats.compilation.assets);
            const jsMappings = assets.filter((asset) => asset.endsWith('.js.map'));
            const everyJsHasSourceMap = assets.every((asset) => {
                if (asset.endsWith('.js')) {
                    return jsMappings.includes(`${asset}.map`);
                }

                return true;
            });

            expect(everyJsHasSourceMap).toBe(true);
        });
    });
});
