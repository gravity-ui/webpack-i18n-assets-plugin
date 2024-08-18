import {expect, testSuite} from 'manten';
import {build} from 'webpack-test-utils';

import {I18nAssetsPlugin} from '../../src';
import {configureWebpack} from '../utils/configure-webpack';
import {localesMulti} from '../utils/localization-data';

export default testSuite(({describe}) => {
    describe('default replacer and resolver', ({test}) => {
        test('keysets', async () => {
            const volume = {
                '/src/utils.js': 'export const i18n = (keyset, key) => keyset + key;',
                '/src/index.js': `
                import {i18n} from "./utils";
                const i18nK = i18n.bind(null, "actions");
                export default i18nK("hello-key");
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
            expect(ruBuild).toBe(localesMulti.ru.actions['hello-key']);
            const enBuild = built.require(`/dist/index.en.js`);
            expect(enBuild).toBe(localesMulti.en.actions['hello-key']);
        });

        test('plurals', async () => {
            const volume = {
                '/src/utils.js': `
                export const encode = (key) => btoa(key) + btoa('salt');
                export const i18n = (keyset, key) => keyset + key;
                `,
                '/src/someModule.js': `
                import {encode} from "./utils";
                export const run = () => encode("qwrwrqqwr");
                `,
                '/src/index.js': `
                import {i18n, encode} from "./utils";
                import {run} from "./someModule";
                run();
                const i18nK = i18n.bind(null, "actions");
                export default i18nK("pluralKey", { count: 10, someArg: encode("qwerty") });
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
                localesMulti.ru.actions.pluralKey[2]
                    .replace('{{count}}', '10')
                    .replace('{{someArg}}', btoa('qwerty') + btoa('salt')),
            );

            const enBuild = built.require(`/dist/index.en.js`);
            expect(enBuild).toBe(
                localesMulti.en.actions.pluralKey[1]
                    .replace('{{count}}', '10')
                    .replace('{{someArg}}', btoa('qwerty') + btoa('salt')),
            );

            const esBuild = built.require('/dist/index.es.js');
            expect(esBuild).toBe(
                localesMulti.es.actions.pluralKey[1]
                    .replace('{{count}}', '10')
                    .replace('{{someArg}}', btoa('qwerty') + btoa('salt')),
            );
        });

        test('params', async () => {
            const volume = {
                '/src/utils.js': `
                export const i18n = (keyset, key) => keyset + key;
                `,
                '/src/index.js': `
                import {i18n} from "./utils";
                const i18nK = i18n.bind(null, "actions");
                export default i18nK("keyWithParam", { param: "yeah" });
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
            expect(ruBuild).toBe(localesMulti.ru.actions.keyWithParam.replace('{{param}}', 'yeah'));

            const enBuild = built.require(`/dist/index.en.js`);
            expect(enBuild).toBe(localesMulti.en.actions.keyWithParam.replace('{{param}}', 'yeah'));

            const esBuild = built.require('/dist/index.es.js');
            expect(esBuild).toBe(localesMulti.es.actions.keyWithParam.replace('{{param}}', 'yeah'));
        });

        test('func in params', async () => {
            const volume = {
                '/src/utils.js': `
                export const encode = (key) => btoa(key) + btoa('salt');
                export const i18n = (keyset, key) => keyset + key;
                `,
                '/src/someModule.js': `
                import {encode} from "./utils";
                export const run = () => encode("qwrwrqqwr");
                `,
                '/src/index.js': `
                import {i18n, encode} from "./utils";
                import {run} from "./someModule";
                run();
                const i18nK = i18n.bind(null, "actions");
                export default i18nK("keyWithParam", { unusedParam: encode("qwerty"), param: encode("qwerty") });
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
                localesMulti.ru.actions.keyWithParam.replace(
                    '{{param}}',
                    btoa('qwerty') + btoa('salt'),
                ),
            );

            const enBuild = built.require(`/dist/index.en.js`);
            expect(enBuild).toBe(
                localesMulti.en.actions.keyWithParam.replace(
                    '{{param}}',
                    btoa('qwerty') + btoa('salt'),
                ),
            );

            const esBuild = built.require('/dist/index.es.js');
            expect(esBuild).toBe(
                localesMulti.es.actions.keyWithParam.replace(
                    '{{param}}',
                    btoa('qwerty') + btoa('salt'),
                ),
            );
        });

        test('i18n in params', async () => {
            const volume = {
                '/src/utils.js': `
export const i18n = (keyset, key) => keyset + key;
                `,
                '/src/index.js': `
import {i18n} from "./utils";
const i18nK = i18n.bind(null, "actions");
export default i18nK("keyWithParam", { param: i18nK("qwerty") });`,
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
                localesMulti.ru.actions.keyWithParam.replace(
                    '{{param}}',
                    localesMulti.ru.actions.qwerty,
                ),
            );

            const enBuild = built.require(`/dist/index.en.js`);
            expect(enBuild).toBe(
                localesMulti.en.actions.keyWithParam.replace(
                    '{{param}}',
                    localesMulti.en.actions.qwerty,
                ),
            );

            const esBuild = built.require('/dist/index.es.js');
            expect(esBuild).toBe(
                localesMulti.es.actions.keyWithParam.replace(
                    '{{param}}',
                    localesMulti.es.actions.qwerty,
                ),
            );
        });

        test('double embedding of the i18n in params', async () => {
            const volume = {
                '/src/utils.js': `
export const i18n = (keyset, key) => keyset + key;
                `,
                '/src/index.js': `
import {i18n} from "./utils";
const i18nK = i18n.bind(null, "actions");
export default i18nK("keyWithParam", {
    param: i18nK("qwertyWithParam", {
        qwertyParam: i18nK("qwerty")
    })
});`,
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
                localesMulti.ru.actions.keyWithParam.replace(
                    '{{param}}',
                    localesMulti.ru.actions.qwertyWithParam.replace(
                        '{{qwertyParam}}',
                        localesMulti.ru.actions.qwerty,
                    ),
                ),
            );

            const enBuild = built.require(`/dist/index.en.js`);
            expect(enBuild).toBe(
                localesMulti.en.actions.keyWithParam.replace(
                    '{{param}}',
                    localesMulti.en.actions.qwertyWithParam.replace(
                        '{{qwertyParam}}',
                        localesMulti.en.actions.qwerty,
                    ),
                ),
            );

            const esBuild = built.require('/dist/index.es.js');
            expect(esBuild).toBe(
                localesMulti.es.actions.keyWithParam.replace(
                    '{{param}}',
                    localesMulti.es.actions.qwertyWithParam.replace(
                        '{{qwertyParam}}',
                        localesMulti.es.actions.qwerty,
                    ),
                ),
            );
        });

        test('triple i18n in params', async () => {
            const volume = {
                '/src/utils.js': `
export const i18n = (keyset, key) => keyset + key;
                `,
                '/src/index.js': `
import {i18n} from "./utils";
const i18nK = i18n.bind(null, "actions");
export default i18nK("tripleParams", {
    first: i18nK("qwerty"),
    second: i18nK("qwertyWithParam", {
        qwertyParam: i18nK("qwerty")
    }),
    third: i18nK("qwerty"),
});`,
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
                localesMulti.ru.actions.tripleParams
                    .replace('{{first}}', localesMulti.ru.actions.qwerty)
                    .replace(
                        '{{second}}',
                        localesMulti.ru.actions.qwertyWithParam.replace(
                            '{{qwertyParam}}',
                            localesMulti.ru.actions.qwerty,
                        ),
                    )
                    .replace('{{third}}', localesMulti.ru.actions.qwerty),
            );
        });

        test('identical declaration names in rather modules', async () => {
            const volume = {
                '/src/utils.js': `
                export const i18n = (keyset, key) => keyset + key;
                `,
                '/src/main.js': `
                import {i18n} from "./utils";
                const i18nK = i18n.bind(null, "actions");
                export default i18nK("hello-key");
                `,
                '/src/index.js': `
                import {i18n} from "./utils";
                import resultFromOtherModule from "./main.js";
                const i18nK = i18n.bind(null, "someNewKeyset");
                export default resultFromOtherModule + ' ' + i18nK("test-key");
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
                localesMulti.ru.actions['hello-key'] +
                    ' ' +
                    localesMulti.ru.someNewKeyset['test-key'],
            );

            const enBuild = built.require(`/dist/index.en.js`);
            expect(enBuild).toBe(
                localesMulti.en.actions['hello-key'] +
                    ' ' +
                    localesMulti.en.someNewKeyset['test-key'],
            );

            const esBuild = built.require('/dist/index.es.js');
            expect(esBuild).toBe(
                localesMulti.es.actions['hello-key'] +
                    ' ' +
                    localesMulti.es.someNewKeyset['test-key'],
            );
        });

        test('params with literal in key', async () => {
            const volume = {
                '/src/utils.js': `
                export const i18n = (keyset, key) => keyset + key;
                `,
                '/src/index.js': `
                import {i18n} from "./utils";
                const mdn = [].length;
                const i18nK = i18n.bind(null, "actions");
                export default i18nK("keyWithLiteralParam", { 'literal-param': 'yeah' });
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
                localesMulti.ru.actions.keyWithLiteralParam.replace('{{literal-param}}', 'yeah'),
            );

            const enBuild = built.require(`/dist/index.en.js`);
            expect(enBuild).toBe(
                localesMulti.en.actions.keyWithLiteralParam.replace('{{literal-param}}', 'yeah'),
            );

            const esBuild = built.require(`/dist/index.es.js`);
            expect(esBuild).toBe(
                localesMulti.es.actions.keyWithLiteralParam.replace('{{literal-param}}', 'yeah'),
            );
        });

        test('collect unused keys', async () => {
            const volume = {
                '/src/utils.js': `
                export const i18n = (keyset, key) => keyset + key;
                `,
                '/src/index.js': `
                import {i18n} from "./utils";
                const mdn = [].length;
                const i18nK = i18n.bind(null, "actions");
                const i18nNew = i18n.bind(null, "someNewKeyset");
                console.log(i18nK("qwertyWithParam"));
                console.log(i18nNew("hello-key"));
                export default i18nK("keyWithLiteralParam", { 'literal-param': 'yeah' });
                `,
            };

            const built = await build(volume, (config) => {
                configureWebpack(config);

                config.plugins!.push(
                    new I18nAssetsPlugin({
                        locales: localesMulti,
                        collectUnusedKeys: true,
                    }),
                );
            });

            const unusedKeys = built.require(`/dist/unused-keys.json`);
            expect(unusedKeys.includes('someNewKeyset::someNewKeyset')).toBe(false);
            expect(unusedKeys.includes('actions::keyWithLiteralParam')).toBe(false);
            expect(unusedKeys.includes('actions::qwertyWithParam')).toBe(false);
        });
    });
});
