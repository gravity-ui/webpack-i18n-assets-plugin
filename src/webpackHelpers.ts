import type {Configuration} from 'webpack';
import WebpackAssetsManifest from 'webpack-assets-manifest';

import {I18nAssetsPlugin} from './plugin';
import type {Options} from './types';

type Output = Exclude<Configuration['output'], undefined>;

const generateOutput = (originalOutput?: Output): Output => {
    const appendLocale = (filename: string) =>
        filename.includes('[locale]') ? filename : filename.replace('.js', '.[locale].js');

    if (originalOutput) {
        return {
            ...originalOutput,
            filename:
                typeof originalOutput.filename === 'string'
                    ? appendLocale(originalOutput.filename)
                    : originalOutput.filename,
            chunkFilename:
                typeof originalOutput.chunkFilename === 'string'
                    ? appendLocale(originalOutput.chunkFilename)
                    : originalOutput.chunkFilename,
        };
    }

    return {
        filename: 'js/[name].[contenthash:8].[locale].js',
        chunkFilename: 'js/[name].[contenthash:8].chunk.[locale].js',
    };
};

const createManifestPlugins = (localeNames: string[]) => {
    const hasLocale = new RegExp(`\\.(?:${localeNames.join('|')})\\.\\w{2}(?:\\.map)?$`);

    return localeNames.map(
        (locale) =>
            new WebpackAssetsManifest({
                entrypoints: true,
                output: `assets-manifest.${locale}.json`,
                transform: (assets) => {
                    const entrypoints = assets.entrypoints as Record<
                        string,
                        {
                            assets: {
                                js: string[];
                            };
                        }
                    >;

                    Object.keys(entrypoints).forEach((entrypoint) => {
                        const jsAssets = entrypoints[entrypoint].assets.js;
                        entrypoints[entrypoint].assets.js = jsAssets.filter(
                            (key) => !hasLocale.test(key) || key.match(`\\.${locale}\\.`),
                        );
                    });
                },
            }),
    );
};

const removePluginsFromWebpackConfig = (
    plugins: Exclude<Configuration['plugins'], undefined>,
    pluginsToRemove: string[],
) => {
    const newPlugins = [...plugins];

    const remainingPlugins = newPlugins.filter(
        (plugin) => plugin && pluginsToRemove.includes(plugin.constructor.name),
    );

    while (remainingPlugins.length) {
        newPlugins.splice(newPlugins.indexOf(remainingPlugins.pop()), 1);
    }

    return newPlugins;
};

export const applyPluginToWebpackConfig = (
    originalConfig: Configuration,
    options: Options,
): Configuration => {
    if (originalConfig.mode === 'development') {
        return originalConfig;
    }

    const newConfig: Configuration = {
        ...originalConfig,
        output: generateOutput(originalConfig.output),
    };

    if (newConfig.plugins) {
        // Remove the existing WebpackAssetsManifest plugin
        newConfig.plugins = removePluginsFromWebpackConfig(newConfig.plugins, [
            'WebpackAssetsManifest',
        ]);
        // Connect the localization plugin
        newConfig.plugins.unshift(new I18nAssetsPlugin(options));
        // Connect manifests generation
        newConfig.plugins.push(...createManifestPlugins(Object.keys(options.locales)));
    }

    return newConfig;
};
