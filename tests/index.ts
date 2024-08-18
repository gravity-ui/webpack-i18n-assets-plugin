import fs from 'fs/promises';

import {describe} from 'manten';
import webpack from 'webpack';

const webpackCachePath = './node_modules/.cache/webpack';
const removeWebpackCache = async () => {
    const cacheExists = await fs.access(webpackCachePath).then(
        () => true,
        () => false,
    );

    if (cacheExists) {
        await fs.rm(webpackCachePath, {
            recursive: true,
            force: true,
        });
    }
};

describe(`Webpack ${webpack.version}`, async ({runTestSuite}) => {
    await removeWebpackCache();

    runTestSuite(import('./specs/default.spec'));
    runTestSuite(import('./specs/contenthash.spec'));
    runTestSuite(import('./specs/passing.spec'));
    runTestSuite(import('./specs/nesting.spec'));
});
