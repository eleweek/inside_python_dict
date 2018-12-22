const webpack = require('webpack');
const merge = require('webpack-merge');
const common = require('./webpack.common.js');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = merge(common, {
    mode: 'production',
    devtool: 'source-map',
    plugins: [
        new webpack.optimize.ModuleConcatenationPlugin(),
        new webpack.DefinePlugin({
            'process.env.NODE_ENV': JSON.stringify('production'),
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
        new BundleAnalyzerPlugin(),
    ],
});
