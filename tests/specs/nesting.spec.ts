import {expect, testSuite} from 'manten';
import {build} from 'webpack-test-utils';

import {I18nAssetsPlugin} from '../../src';
import {configureWebpack} from '../utils/configure-webpack';
import {localesMulti} from '../utils/localization-data';

export default testSuite(({describe}) => {
    describe('nesting translations', ({test}) => {
        test('correct translation with nesting translations', async () => {
            const volume = {
                '/src/utils.js': `
                    export const i18n = (keyset, key) => keyset + key;
                `,
                '/src/index.js': `
                    import {i18n} from "./utils";
                    const i18nK = i18n.bind(null, "nesting");
                    export default i18nK("nestingService");
                `,
            };

            const built = await build(volume, (config) => {
                configureWebpack(config);

                config.plugins!.push(
                    new I18nAssetsPlugin({
                        locales: localesMulti,
                    }),
                );
            });

            const ruBuild = built.require(`/dist/index.ru.js`);
            expect(ruBuild).toBe(
                localesMulti.ru.nesting.nestingService
                    .replace('$t{global::app}', localesMulti.ru.global.app)
                    .replace('$t{global::service}', localesMulti.ru.global.service)
                    .replace('$t{open}', localesMulti.ru.nesting.open),
            );

            const enBuild = built.require(`/dist/index.en.js`);
            expect(enBuild).toBe(
                localesMulti.en.nesting.nestingService
                    .replace('$t{global::app}', localesMulti.en.global.app)
                    .replace('$t{global::service}', localesMulti.en.global.service)
                    .replace('$t{open}', localesMulti.en.nesting.open),
            );
        });

        test('failed translation with deep nesting translations', async () => {
            const volume = {
                '/src/utils.js': `
                    export const i18n = (keyset, key) => keyset + key;
                `,
                '/src/index.js': `
                    import {i18n} from "./utils";
                    const i18nK = i18n.bind(null, "nesting");
                    export default i18nK("deepNesting");
                `,
            };

            const built = await build(volume, (config) => {
                configureWebpack(config);

                config.plugins!.push(
                    new I18nAssetsPlugin({
                        locales: localesMulti,
                    }),
                );
            });

            let failed;
            try {
                built.require(`/dist/index.ru.js`);
            } catch (e) {
                failed = true;
            }
            expect(failed).toBe(true);
        });

        test('failed translation with nesting plural', async () => {
            const volume = {
                '/src/utils.js': `
                    export const i18n = (keyset, key) => keyset + key;
                `,
                '/src/index.js': `
                    import {i18n} from "./utils";
                    const i18nK = i18n.bind(null, "nesting");
                    export default i18nK("failedNestingWithPlural");
                `,
            };

            const built = await build(volume, (config) => {
                configureWebpack(config);

                config.plugins!.push(
                    new I18nAssetsPlugin({
                        locales: localesMulti,
                    }),
                );
            });

            let failed;
            try {
                built.require(`/dist/index.ru.js`);
            } catch (e) {
                failed = true;
            }
            expect(failed).toBe(true);
        });

        test('failed translation with nesting in plural form', async () => {
            const volume = {
                '/src/utils.js': `
                    export const i18n = (keyset, key) => keyset + key;
                `,
                '/src/index.js': `
                    import {i18n} from "./utils";
                    const i18nK = i18n.bind(null, "nesting");
                    export default i18nK("pluralKey", { count: 10 });
                `,
            };

            const built = await build(volume, (config) => {
                configureWebpack(config);

                config.plugins!.push(
                    new I18nAssetsPlugin({
                        locales: localesMulti,
                    }),
                );
            });

            let failed;
            try {
                built.require(`/dist/index.ru.js`);
            } catch (e) {
                failed = true;
            }
            expect(failed).toBe(true);
        });
    });
});
