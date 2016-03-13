export function materialColor () {
  const choices = [0xff5177, 0x7c4dff, 0x18ffff, 0x5af158, 0xeeff41, 0xffab40, 0xff6e40]

  return choices[Math.floor(Math.random() * choices.length)]
}

export function funColor () {
  return superFunColor(((0x80 + Math.random() * 0x80) << 16) | ((0x80 + Math.random() * 0x80) << 8) | ((0x80 + Math.random() * 0x80)))
}

export function superFunColor (input) {
  let choices = [0xff00ff, 0xffff00, 0x00ffff, 0x0000ff, 0x00ff00, 0xff0000]

  return input & choices[Math.floor(Math.random() * choices.length)]
}

export function createConnectedPolygon (point, thickness, last_points, point2) {
  const angle = Math.atan2(point2.y - point.y, point2.x - point.x)
  const angle_perp = angle + Math.PI / 2

  return [
    point.x + (Math.cos(angle_perp) * thickness / 2),
    point.y + (Math.sin(angle_perp) * thickness / 2),
  ].concat(last_points).concat([
    point.x - (Math.cos(angle_perp) * thickness / 2),
    point.y - (Math.sin(angle_perp) * thickness / 2),
  ])
}

export function createPolygon (point1, point2, thickness1, thickness2) {
  const angle = Math.atan2(point2.y - point1.y, point2.x - point1.x)
  const angle_perp = angle + Math.PI / 2

  return [
    point1.x + (Math.cos(angle_perp) * thickness1 / 2),
    point1.y + (Math.sin(angle_perp) * thickness1 / 2),

    point2.x + (Math.cos(angle_perp) * thickness2 / 2),
    point2.y + (Math.sin(angle_perp) * thickness2 / 2),

    point2.x - (Math.cos(angle_perp) * thickness2 / 2),
    point2.y - (Math.sin(angle_perp) * thickness2 / 2),

    point1.x - (Math.cos(angle_perp) * thickness1 / 2),
    point1.y - (Math.sin(angle_perp) * thickness1 / 2),
  ]
}

export function chunk (arr, n) {
  return arr.slice(0,(arr.length+n-1)/n|0).map(function(_,i) { return arr.slice(n*i,n*i+n); });
}
