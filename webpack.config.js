const path = require('path')
const HtmlWebpackPlugin = require('html-webpack-plugin')
const webpack = require('webpack')

module.exports = (env) => {
  env = env || {}

  const NODE_ENV = env.prod ? 'production' : 'development'

  const alias = {}

  if (!env.devtools) {
    alias["configureStore$"] = "configureStore.prod"
    alias["showDevtools$"] = "showDevtools.prod"
  }

  return {
    devServer: {
      disableHostCheck: true,
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.webpack.js', '.web.js', '.js'],
      modules: [path.resolve(__dirname, 'src'), 'node_modules'],
      alias,
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
        favicon: './src/favicon.png',
        inject: 'body',
        hash: true,
      }),
      new webpack.DefinePlugin({
        'process.env': JSON.stringify(NODE_ENV),
        'BUILDTIME': Date.now(),
      }),
      new webpack.ContextReplacementPlugin(/.*/, path.resolve(__dirname, 'node_modules', 'jsondiffpatch'), {
        '../package.json': './package.json',
        './formatters': './src/formatters/index.js',
        './console': './src/formatters/console.js'
      })
    ]
  }
}
