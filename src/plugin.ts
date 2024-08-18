import webpack from 'webpack';

import {
    gravityI18nDeclarationResolver,
    gravityI18nImportResolver,
    gravityI18nReplacer,
} from './frameworks';
import {runLocalizer} from './localizer';
import {Options, validateOptions} from './types';
import {collectUnusedKeys} from './utils/collect-unused-keys';

export class I18nAssetsPlugin {
    private options: Options;

    constructor(options: Options) {
        validateOptions(options);
        this.options = options;
    }

    apply(compiler: webpack.Compiler) {
        compiler.hooks.thisCompilation.tap(
            'I18nAssetsPlugin',
            (compilation, {normalModuleFactory}) => {
                const replacer = this.options.replacer ?? gravityI18nReplacer;
                const importResolver = this.options.importResolver ?? gravityI18nImportResolver;
                const declarationResolver =
                    this.options.declarationResolver ?? gravityI18nDeclarationResolver;

                const trackUsedKeys = this.options.collectUnusedKeys
                    ? collectUnusedKeys(compilation, this.options.locales)
                    : undefined;

                runLocalizer(
                    compilation,
                    normalModuleFactory,
                    this.options.locales,
                    replacer,
                    importResolver,
                    declarationResolver,
                    trackUsedKeys,
                );
            },
        );
    }
}
