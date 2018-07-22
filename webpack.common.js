const webpack = require('webpack'); 
const path = require('path');
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

extractCSS = ({ include, exclude, use = [] }) => {
  // Output extracted CSS to a file
  const plugin = new MiniCssExtractPlugin({
    filename: "dist/bundle.css",
  });

  return {
    module: {
      rules: [
        {
          test: /\.css$/,
          include,
          exclude,

          use: [
            MiniCssExtractPlugin.loader,
          ].concat(use),
        },
      ],
    },
    plugins: [plugin],
  };
};

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'browser-bundle.js',
    path: path.resolve(__dirname, 'dist')
  },
  devtool: 'cheap-module-eval-source-map',
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
    new MiniCssExtractPlugin({filename: 'bundle.css'}),
    new BundleAnalyzerPlugin()
   ]
};
