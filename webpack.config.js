module.exports = {
  resolve: {
    extensions: ['.ts', '.tsx', '.webpack.js', '.web.js', '.js']
  },
  devtool: 'source-map',
  entry: './index.tsx',
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
      { test: /\.json$/, loader: 'json-loader' }
    ]
  },
}
