module.exports = {
  entry: './game/main.js',
  output: {
    path: __dirname + '/game',
    filename: 'bundle.js'
  },
  node: {
    fs: 'empty'
  },
  module: {
    loaders: [
      { test: /\.js$/, exclude: /node_modules/, loader: 'babel-loader', query: { presets: ['es2015', 'stage-0'] } },
      { test: /\.json$/, exclude: /node_modules/, loader: 'json' },
      { test: /\.json$/, include: /node_modules[\/\\](pixi.js|p2)/, loader: 'json' }
    ]
  }
}
