import {expect, testSuite} from 'manten';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';
import TerserPlugin from 'terser-webpack-plugin';
import {WebpackManifestPlugin} from 'webpack-manifest-plugin';
import {build} from 'webpack-test-utils';

import {I18nAssetsPlugin} from '../../src';
import {configureWebpack} from '../utils/configure-webpack.js';
import {localesMulti} from '../utils/localization-data.js';

export default testSuite(({describe}, isWebpack5?: boolean) => {
    describe('passing', ({test}) => {
        test('multi locale', async () => {
            const built = await build(
                {
                    '/src/utils.js': 'export const i18n = (keyset, key) => keyset + key;',
                    '/src/index.js': `
                    import {i18n} from "./utils";
                    const i18nK = i18n.bind(null, "actions");
                    export default [${Object.keys(localesMulti.en.actions)
                        .filter((key) => !Array.isArray(localesMulti.en.actions[key]))
                        .map((key) => `i18nK(${JSON.stringify(key)})`)
                        .join(',')}]`,
                },
                (config) => {
                    configureWebpack(config);

                    config.plugins!.push(
                        new I18nAssetsPlugin({
                            locales: localesMulti,
                        }),
                    );
                },
            );

            const {assets} = built.stats.compilation;
            expect(Object.keys(assets).length).toBe(4);

            const ruBuild = built.require('/dist/index.ru.js');
            expect(ruBuild).toEqual(
                Object.values(localesMulti.ru.actions).filter((val) => !Array.isArray(val)),
            );

            const enBuild = built.require('/dist/index.en.js');
            expect(enBuild).toEqual(
                Object.values(localesMulti.en.actions).filter((val) => !Array.isArray(val)),
            );

            const esBuild = built.require('/dist/index.es.js');
            expect(esBuild).toEqual(
                Object.values(localesMulti.es.actions).filter((val) => !Array.isArray(val)),
            );

            const jaBuild = built.require('/dist/index.ja.js');
            expect(jaBuild).toEqual(
                Object.values(localesMulti.ja.actions).filter((val) => !Array.isArray(val)),
            );

            const statsOutput = built.stats.toString();
            expect(statsOutput).toMatch(/index\.en\.js/);
            expect(statsOutput).toMatch(/index\.es\.js/);
            expect(statsOutput).toMatch(/index\.ja\.js/);
        });

        test('localize assets with chunks', async () => {
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
                    configureWebpack(config);

                    config.plugins!.push(
                        new I18nAssetsPlugin({
                            locales: localesMulti,
                        }),
                    );
                },
            );

            const {assets} = built.stats.compilation;
            expect(Object.keys(assets).length).toBe(12);

            const ruBuild = await built.require('/dist/index.ru.js');
            expect(ruBuild).toBe(localesMulti.ru.actions['hello-key']);

            const enBuild = await built.require('/dist/index.en.js');
            expect(enBuild).toBe(localesMulti.en.actions['hello-key']);

            const esBuild = await built.require('/dist/index.es.js');
            expect(esBuild).toBe(localesMulti.es.actions['hello-key']);

            const jaBuild = await built.require('/dist/index.ja.js');
            expect(jaBuild).toBe(localesMulti.ja.actions['hello-key']);
        });

        test('works with minification and different contexts for i18nK() usages', async () => {
            const built = await build(
                {
                    '/src/utils.js': 'export const i18n = (keyset, key) => keyset + key;',
                    '/src/index.js': `
                        import {i18n} from "./utils";
                        const i18nK = i18n.bind(null, "actions");
						export default {
							test1: i18nK("hello-key") + " world and " + i18nK("stringWithDoubleQuotes"),
						    test2: i18nK("hello-key").length,
						    test3: [i18nK("hello-key"), i18nK("stringWithDoubleQuotes")],
						    test4: i18nK("hello-key") || "hello",
						    test5: i18nK("hello-key") ? "hello" : "goodbye",
						};
					`,
                },
                (config) => {
                    configureWebpack(config);

                    config.optimization!.minimize = true;

                    if (isWebpack5) {
                        config.optimization!.minimizer = [
                            new TerserPlugin({
                                parallel: false,
                            }),
                        ];
                    }

                    config.plugins!.push(
                        new I18nAssetsPlugin({
                            locales: localesMulti,
                        }),
                    );
                },
            );

            expect(built.stats.hasWarnings()).toBe(false);
            expect(built.stats.hasErrors()).toBe(false);

            const enBuild = await built.require('/dist/index.en.js');
            expect(enBuild.test1).toBe(
                `${localesMulti.en.actions['hello-key']} world and ${localesMulti.en.actions.stringWithDoubleQuotes}`,
            );
            expect(enBuild.test2).toBe(localesMulti.en.actions['hello-key'].length);
            expect(enBuild.test3).toEqual([
                localesMulti.en.actions['hello-key'],
                localesMulti.en.actions.stringWithDoubleQuotes,
            ]);
            expect(enBuild.test4).toBe(localesMulti.en.actions['hello-key']);
            expect(enBuild.test5).toBe('hello');

            // Assert that asset is minified
            expect(built.fs.readFileSync('/dist/index.en.js').toString()).not.toMatch(/\s{2,}/);
            expect(built.fs.readFileSync('/dist/index.ja.js').toString()).not.toMatch(/\s{2,}/);
        });

        test('handle CSS', async () => {
            const built = await build(
                {
                    '/src/index.js': 'import "./style.css";',
                    '/src/style.css': 'body { color: red; }',
                },
                (config) => {
                    configureWebpack(config);

                    config.module!.rules.push({
                        test: /\.css$/,
                        use: [MiniCssExtractPlugin.loader, 'css-loader'],
                    });

                    config.plugins!.push(
                        new I18nAssetsPlugin({
                            locales: localesMulti,
                        }),
                        new MiniCssExtractPlugin({
                            filename: '[name].[locale].css',
                        }) as any,
                    );
                },
            );

            const {assets} = built.stats.compilation;

            expect(assets).toHaveProperty(['index.en.css']);
            expect(assets).toHaveProperty(['index.ja.css']);
        });

        test('handle CSS without localization', async () => {
            const built = await build(
                {
                    '/src/index.js': 'import "./style.css";',
                    '/src/style.css': 'body { color: red; }',
                },
                (config) => {
                    configureWebpack(config);

                    config.module!.rules.push({
                        test: /\.css$/,
                        use: [MiniCssExtractPlugin.loader, 'css-loader'],
                    });

                    config.plugins!.push(
                        new I18nAssetsPlugin({
                            locales: localesMulti,
                        }),
                        new MiniCssExtractPlugin() as any,
                    );
                },
            );

            const {assets} = built.stats.compilation;

            expect(assets).toHaveProperty(['index.css']);
        });

        test('unused locale with minification', async () => {
            const built = await build(
                {
                    '/src/utils.js': 'export const i18n = (keyset, key) => keyset + key;',
                    '/src/index.js': `
                    import {i18n} from "./utils";
                    const i18nK = i18n.bind(null, "actions");
                    i18nK("hello-key");
                    `,
                },
                (config) => {
                    configureWebpack(config);

                    config.optimization!.minimize = true;

                    if (isWebpack5) {
                        config.optimization!.minimizer = [
                            new TerserPlugin({
                                parallel: false,
                            }),
                        ];
                    }

                    config.plugins!.push(
                        new I18nAssetsPlugin({
                            locales: localesMulti,
                        }),
                    );
                },
            );

            const {assets} = built.stats.compilation;

            expect(Object.keys(assets)).toStrictEqual([
                'index.ru.js',
                'index.en.js',
                'index.es.js',
                'index.ja.js',
            ]);
        });

        test('emits source-maps', async () => {
            const built = await build(
                {
                    '/src/utils.js': 'export const i18n = (keyset, key) => keyset + key;',
                    '/src/index.js': `
                    import {i18n} from "./utils";
                    const i18nK = i18n.bind(null, "actions");
                    export default i18nK("hello-key");
                    `,
                },
                (config) => {
                    configureWebpack(config);

                    config.devtool = 'source-map';
                    config.plugins!.push(
                        new I18nAssetsPlugin({
                            locales: localesMulti,
                        }),
                    );
                },
            );

            const {assets} = built.stats.compilation;

            expect(assets).toHaveProperty(['index.ru.js.map']);
            expect(assets).toHaveProperty(['index.en.js.map']);
            expect(assets).toHaveProperty(['index.es.js.map']);
            expect(assets).toHaveProperty(['index.ja.js.map']);
            expect(Object.keys(assets).length).toBe(8);
        });

        test('works with WebpackManifestPlugin', async () => {
            const hasLocale = /\.(?:en|es|ja)\.\w{2}(?:\.map)?$/;
            const localeNames = Object.keys(localesMulti);
            const built = await build(
                {
                    '/src/index.js': 'import "./style.css";',
                    '/src/style.css': 'body { color: red; }',
                },
                (config) => {
                    configureWebpack(config);

                    config.devtool = 'source-map';

                    config.module!.rules.push({
                        test: /\.css$/,
                        use: [MiniCssExtractPlugin.loader, 'css-loader'],
                    });

                    config.plugins!.push(
                        new MiniCssExtractPlugin() as any,
                        new I18nAssetsPlugin({
                            locales: localesMulti,
                        }),
                        ...localeNames.map(
                            (locale) =>
                                new WebpackManifestPlugin({
                                    fileName: `manifest.${locale}.json`,
                                    filter: (file) =>
                                        !file.isAsset &&
                                        (!hasLocale.test(file.path) ||
                                            Boolean(file.path.match(`.${locale}.`))),
                                }),
                        ),
                    );
                },
            );

            const manifestEn = built.require('/dist/manifest.en.json');
            expect(manifestEn).toMatchObject({
                'index.css': 'index.css',
                'index.js': 'index.en.js',
            });

            const manifestEs = built.require('/dist/manifest.es.json');
            expect(manifestEs).toMatchObject({
                'index.css': 'index.css',
                'index.js': 'index.es.js',
            });

            const manifestJa = built.require('/dist/manifest.ja.json');
            expect(manifestJa).toMatchObject({
                'index.css': 'index.css',
                'index.js': 'index.ja.js',
            });
        });

        test('function filename with Wepback placeholder', async () => {
            const built = await build(
                {
                    '/src/utils.js': 'export const i18n = (keyset, key) => keyset + key;',
                    '/src/index.js': `
                    import {i18n} from "./utils";
                    const i18nK = i18n.bind(null, "actions");
                    export default i18nK("hello-key");
                    `,
                },
                (config) => {
                    config.output!.filename = () => '[name].fn.[locale].[fullhash].js';
                    config.output!.chunkFilename = () => '[name].fn.[locale].[fullhash].js';

                    config.plugins!.push(
                        new I18nAssetsPlugin({
                            locales: localesMulti,
                        }),
                    );
                },
            );

            const {assets} = built.stats.compilation;
            expect(Object.keys(assets).length).toBe(4);

            const {hash} = built.stats;

            const enBuild = built.require(`/dist/index.fn.en.${hash}.js`);
            expect(enBuild).toBe(localesMulti.en.actions['hello-key']);

            const esBuild = built.require(`/dist/index.fn.es.${hash}.js`);
            expect(esBuild).toBe(localesMulti.es.actions['hello-key']);

            const jaBuild = built.require(`/dist/index.fn.ja.${hash}.js`);
            expect(jaBuild).toBe(localesMulti.ja.actions['hello-key']);

            const statsOutput = built.stats.toString();
            expect(statsOutput).toMatch(/index\.fn\.en\./);
            expect(statsOutput).toMatch(/index\.fn\.es\./);
            expect(statsOutput).toMatch(/index\.fn\.ja\./);
        });

        // TODO: unsupported eval mode
        /*
        test('devtool eval', async () => {
            const built = await build(
                {
                    '/src/utils.js': 'export const i18n = (keyset, key) => keyset + key;',
                    '/src/index.js': `
                            import {i18n} from "./utils";
                            const i18nK = i18n.bind(null, "actions");
                            export default [${[
                                'i18nK("hello-key")',
                                'i18nK("stringWithDoubleQuotes")',
                                'i18nK("stringWithSingleQuotes")',
                                "i18nK('stringWithDoubleQuotes')",
                                "i18nK('stringWithSingleQuotes')",
                            ].join(',')}];`,
                },
                (config) => {
                    configureWebpack(config);

                    config.devtool = 'eval';
                    config.plugins!.push(
                        new I18nAssetsPlugin({
                            locales: localesMulti,
                        }),
                    );
                },
            );

            const {assets} = built.stats.compilation;

            expect(Object.keys(assets)).toStrictEqual([
                'index.en.js',
                'index.es.js',
                'index.ja.js',
            ]);

            console.log(built.fs.readFileSync('/dist/index.en.js', {encoding: 'utf8'}));

            const enBuild = built.require('/dist/index.en.js');
            expect(enBuild).toEqual([
                localesMulti.en.actions['hello-key'],
                localesMulti.en.actions.stringWithDoubleQuotes,
                localesMulti.en.actions.stringWithSingleQuotes,
                localesMulti.en.actions.stringWithDoubleQuotes,
                localesMulti.en.actions.stringWithSingleQuotes,
            ]);
        });
        */
    });
});
