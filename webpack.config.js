module.exports = {
  resolve: {
    extensions: ['', '.ts', '.webpack.js', '.web.js', '.js']
  },
  devtool: 'source-map',
  entry: './game/main.ts',
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
      { test: /\.ts$/, exclude: /node_modules/, loader: 'awesome-typescript-loader' },
      { test: /\.json$/, loader: 'json-loader' }
    ]
  }
}
