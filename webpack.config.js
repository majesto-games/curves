const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')

module.exports = (env) => {
  env = env || {}

  const NODE_ENV = env.prod ? 'production' : 'development'

  return {
    resolve: {
      extensions: ['.ts', '.tsx', '.webpack.js', '.web.js', '.js'],
      modules: [path.resolve(__dirname, 'src'), 'node_modules'],
    },
    devtool: 'source-map',
    entry: './src/index.tsx',
    output: {
      path: __dirname + '/game',
      filename: 'bundle.js'
    },
    node: {
      fs: 'empty',
      tls: 'empty'
    },
    module: {
      loaders: [
        { test: /\.tsx?$/, exclude: /node_modules/, loader: 'awesome-typescript-loader' },
        { test: /\.tsx?$/, exclude: /node_modules/, loader: 'tslint-loader', enforce: 'pre' },
        { test: /\.(png|svg|woff2?|eot|ttf)$/, loader: 'file-loader' },
        { test: /\.css$/, loader: 'style-loader!css-loader' },
        { test: /\.json$/, loader: 'json-loader' }
      ]
    },
    externals: ['ws'],
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/index.html',
        inject: 'body',
        hash: true,
      }),
      new webpack.DefinePlugin({
        'process.env': JSON.stringify(NODE_ENV),
      })
    ]
  }
}
