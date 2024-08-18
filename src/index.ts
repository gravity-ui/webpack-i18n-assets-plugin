export {I18nAssetsPlugin} from './plugin';
export type {
    Options,
    ImportResolver,
    DeclarationResolver,
    ReplacerContext,
    Replacer,
    ReplacerArgs,
} from './types';

export {
    gravityI18nDeclarationResolver,
    gravityI18nImportResolver,
    gravityI18nReplacer,
} from './frameworks';

export {applyPluginToWebpackConfig} from './webpackHelpers';
