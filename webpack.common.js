const webpack = require('webpack'); 
const path = require('path');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CleanWebpackPlugin = require('clean-webpack-plugin');
const {RawSource} = require("webpack-sources");
const {exec} = require('child_process');
const fs = require('fs');


class HackySSR {
    constructor(options) {
        this.options = options;
    }
    apply(compiler) {
        const name = "index.html";
        if (compiler.options.mode === "development") { 
            compiler.plugin("emit", (compilation, cb) => {
                fs.readFile('src/index.html', 'utf8', function (err, file) {
                    compilation.assets[name] = new RawSource(file);
                    cb();
                });
            });
        } else {
            compiler.plugin("emit", (compilation, cb) => {
                exec("npx babel-node ssr.js", function(error, stdout, stderr) {
                    compilation.assets[name] = new RawSource(stdout);
                    cb();
                });
            });
        } 
    }
};

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'browser-bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  module: {
    rules: [
      {
        test: /\.js$/,
        use: {
            loader: 'babel-loader',
            /* presets come from .babelrc */
            options: {
              plugins: ['lodash']
            }
        },
        exclude: /node_modules/
      }, {
        test: /\.css$/,
        use: [
            MiniCssExtractPlugin.loader,
            'css-loader'
        ]
      }
    ]
  },
  plugins: [
    /*new webpack.ProvidePlugin({
        Popper: ['popper.js', 'default'],
    }),*/
    new CleanWebpackPlugin(["dist"]),
    new MiniCssExtractPlugin({filename: 'bundle.css'}),
    new HackySSR()
   ]
};
