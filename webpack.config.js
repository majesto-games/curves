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
    fs: 'empty'
  },
  module: {
    loaders: [
      { test: /\.ts$/, exclude: /node_modules/, loader: 'awesome-typescript-loader' },
      { test: /\.json$/, exclude: /node_modules/, loader: 'json' },
      { test: /\.json$/, include: /node_modules[\/\\](pixi.js|p2)/, loader: 'json' }
    ]
  }
}
