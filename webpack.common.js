const webpack = require('webpack');
const path = require('path');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const {RawSource} = require('webpack-sources');
const {exec} = require('child_process');
const fs = require('fs');

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
        new CleanWebpackPlugin(['dist']),
        new MiniCssExtractPlugin({
            filename: '[name].[contenthash].css',
        }),
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
