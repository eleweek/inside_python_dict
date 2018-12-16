const webpack = require('webpack');
const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const {RawSource} = require('webpack-sources');
const {exec} = require('child_process');
const fs = require('fs');

class HackySSR {
    constructor(options) {
        this.options = options;
    }
    apply(compiler) {
        // TODO: this duplicates mustache jsons. There should probably be a single source of truth
        const files = {
            'all.html': '["chapter1", "chapter2", "chapter3", "chapter4"]',
            'chapter1.html': '["chapter1"]',
            'chapter2.html': '["chapter2"]',
            'chapter3.html': '["chapter3"]',
            'chapter4.html': '["chapter4"]',
        };

        for (let [name, chapters] of Object.entries(files)) {
            const origName = name.replace('.html', '.before-hwp.html');
            if (compiler.options.mode === 'development') {
                console.log('emit', origName);
                compiler.plugin('emit', (compilation, cb) => {
                    fs.readFile(`build/${origName}`, 'utf8', function(err, file) {
                        fs.writeFileSync(`build/${name}`, file);
                        // compilation.assets[name] = new RawSource(file);
                        cb();
                    });
                });
            } else {
                compiler.plugin('emit', (compilation, cb) => {
                    exec(
                        `npm run --silent babel-node scripts/ssr.js build/${origName} '${chapters}'`,
                        {maxBuffer: 10 * 1024 * 1024},
                        function(error, stdout, stderr) {
                            error && console.error(error);
                            stderr && console.error(stderr);
                            fs.writeFileSync(`build/${name}`, stdout);
                            // compilation.assets[name] = new RawSource(stdout);
                            cb();
                        }
                    );
                });
            }
        }
    }
}

module.exports = {
    entry: './src/index.js',
    output: {
        filename: '[name].[contenthash].js',
        path: path.resolve(__dirname, 'dist'),
    },
    module: {
        rules: [
            {
                test: /\.js$/,
                use: {
                    loader: 'babel-loader',
                    /* presets come from .babelrc */
                    options: {
                        plugins: ['lodash'],
                    },
                },
            },
            {
                test: /\.css$/,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
            },
        ],
    },
    plugins: [
        new MiniCssExtractPlugin({
            filename: '[name].[contenthash].css',
        }),
        new HackySSR(),
        new HtmlWebpackPlugin({
            template: 'build/chapter1.html',
            filename: 'chapter1.html',
        }),
        new HtmlWebpackPlugin({
            template: 'build/chapter2.html',
            filename: 'chapter2.html',
        }),
        new HtmlWebpackPlugin({
            template: 'build/chapter3.html',
            filename: 'chapter3.html',
        }),
        new HtmlWebpackPlugin({
            template: 'build/chapter4.html',
            filename: 'chapter4.html',
        }),
        new HtmlWebpackPlugin({
            template: 'build/all.html',
            filename: 'all.html',
        }),
    ],
    watchOptions: {
        // does not work properly, ssr/mustache/etc is a mess now
        ignored: /\.html$/,
    },
    optimization: {
        runtimeChunk: 'single',
        splitChunks: {
            cacheGroups: {
                vendor: {
                    test: /[\\/]node_modules[\\/]/,
                    name: 'vendors',
                    chunks: 'all',
                },
            },
        },
    },
};
