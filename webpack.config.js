const path = require('path')

module.exports = {
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
      { test: /\.png$/, loader: 'file-loader' },
      { test: /\.css$/, loader: 'style-loader!css-loader' },
      { test: /\.json$/, loader: 'json-loader' }
    ]
  },
  externals: ['ws']
}
