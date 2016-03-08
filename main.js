import expect from "expect"
import { Graphics, Sprite, Texture, autoDetectRenderer, Container, utils } from "pixi.js"
import keys from "./keys.js"
import p2 from "p2"

// Remove pesky pixi.js banner from console
utils._saidHello = true

const renderer = autoDetectRenderer(window.innerWidth, window.innerHeight, { backgroundColor: 0x000000 })

const player = new Graphics()
player.beginFill(0xffffff)
player.drawCircle(0, 0, 2.5)
player.position.x = window.innerWidth / 2 - (46/2)
player.position.y = window.innerHeight / 2 - (64/2)
player.endFill()
// player.anchor = { x: 0.5, y: 0.5 }

const container = new Container()

const graphics = new Graphics()

container.addChild(graphics)

document.getElementById("game").appendChild(renderer.view)

const rotationSpeed = 0.05
const moveSpeed = 2
const keydown = { left: false, right: false }

let fatness = 5

function funColor () {
  return superFunColor(((0x80 + Math.random() * 0x80) << 16) | ((0x80 + Math.random() * 0x80) << 8) | ((0x80 + Math.random() * 0x80)))
}

function superFunColor (input) {
  let choices = [0xff00ff, 0xffff00, 0x00ffff, 0x0000ff, 0x00ff00, 0xff0000]

  return input & choices[Math.floor(Math.random() * choices.length)]
}

let lx = player.x
let ly = player.y
let lfatness = fatness
let color = funColor()
let skip_tail_ticker = 0

// const polygonContainsPoint = (point, points) => {
//   // TODO Check wether the point is in the bounding box of the polygon

//   let is_inside = false

//   let prev = points[points.length - 1] // Set 'prev' to be the last element in 'points'

//   for (let p of points) {
//     const max_x = Math.max(p.x, prev.x)
//     const min_x = Math.min(p.x, prev.x)
//     const max_y = Math.max(p.y, prev.y)
//     const min_y = Math.min(p.y, prev.y)

//     if (point.y >= min_y && point.y < max_y && point.x > min_x) { // Check bounding box
//       if (point.x > max_x) { // If the point is left of the box, it counts as an intersection
//         is_inside = !is_inside
//       } else { // Calculate shit with y=kx+m
//         const line_k = (prev.y - p.y) / (prev.x - p.x)
//         const start = prev.x < p.x ? prev : p
//         const line_x = start.x + ((p.y - start.y) / line_k)

//         if (p.x < line_x) {
//           is_inside = !is_inside
//         }
//       }
//     }

//     prev = p
//   }

//   return is_inside
// }
//
// expect(polygonContainsPoint({ x: 10, y: 10 },
//   [{ x: 5, y: 5 }, { x: 5, y: 15 }, { x: 15, y: 15 }, { x: 15, y: 5 }])).toBe(true)
// expect(polygonContainsPoint({ x: 20, y: 20 },
//   [{ x: 5, y: 5 }, { x: 5, y: 15 }, { x: 15, y: 15 }, { x: 15, y: 5 }])).toBe(false)
// expect(polygonContainsPoint({ x: 5, y: 5 },
//   [{ x: 2, y: 0 }, { x: 7, y: 3 }, { x: 8, y: 5 }, { x: 0, y: 7 }])).toBe(true)

const createPolygon = (point1, point2, thickness1, thickness2) => {
  const angle = Math.atan2(point2.y - point1.y, point2.x - point1.x)
  const angle_perp = angle + Math.PI / 2

  return new PIXI.Polygon([
    point1.x + (Math.cos(angle_perp) * thickness1 / 2),
    point1.y + (Math.sin(angle_perp) * thickness1 / 2),

    point2.x + (Math.cos(angle_perp) * thickness2 / 2),
    point2.y + (Math.sin(angle_perp) * thickness2 / 2),

    point2.x - (Math.cos(angle_perp) * thickness2 / 2),
    point2.y - (Math.sin(angle_perp) * thickness2 / 2),

    point1.x - (Math.cos(angle_perp) * thickness1 / 2),
    point1.y - (Math.sin(angle_perp) * thickness1 / 2),
  ])
}

function chunk(arr, n) {
  return arr.slice(0,(arr.length+n-1)/n|0).map(function(_,i) { return arr.slice(n*i,n*i+n); });
}

const createTail = (x, y, fatness) => {
  let r = Math.random()
  let pol = null

  if (skip_tail_ticker === 0) {
    if (r < 0.9) {
      pol = createPolygon({ x, y }, { x: lx, y: ly }, fatness, lfatness)
    } else {
      skip_tail_ticker = 3
    }
  } else {
    skip_tail_ticker--
  }

  lx = x
  ly = y
  lfatness = fatness

  return pol
}

container.addChild(player)

let tail_ticker = 0

let polygon_tail = []

const im = new PIXI.interaction.InteractionManager(renderer)

let running = true
let game_over = false

const text = new PIXI.Text("GAME OVER", { font: "64px Impact", fill: "red" })

text.x = window.innerWidth / 2 - text.width / 2
text.y = window.innerHeight / 2 - text.height / 2

const gameLogic = () => {
  player.x += Math.sin(player.rotation) * moveSpeed
  player.y -= Math.cos(player.rotation) * moveSpeed

  if (keys.left.pressed)
    player.rotation = (player.rotation - rotationSpeed) % (2 * Math.PI)

  if (keys.right.pressed)
    player.rotation = (player.rotation + rotationSpeed) % (2 * Math.PI)

  // if (keys.up.pressed)
  //   fatness += 0.1

  // if (keys.down.pressed)
  //   fatness -= 0.1

  if (player.rotation < 0)
    player.rotation += 2 * Math.PI

  if (player.x > window.innerWidth + 32) {
    player.x = -32
    lx = player.x
  }

  if (player.y > window.innerHeight + 32) {
    player.y = -32
    ly = player.y
  }

  if (player.x < -32) {
    player.x = window.innerWidth + 32
    lx = player.x
  }

  if (player.y < -32) {
    player.y = window.innerHeight + 32
    ly = player.y
  }

  if (polygon_tail.some(poly => poly.contains(player.x, player.y))) {
    game_over = true
  }

  if (tail_ticker <= 0) {
    // let x = player.x - Math.sin(player.rotation) * 64
    // let y = player.y + Math.cos(player.rotation) * 64
    let p = createTail(player.x, player.y, fatness)

    if (p !== null) {

      if (polygon_tail.slice(0, -1).some(poly => chunk(p.points, 2).some(([x, y]) => poly.contains(x, y)))) {
        game_over = true
      }

      polygon_tail.push(p)
      graphics.beginFill(0xffffff, 1)
      graphics.drawPolygon(p)
      graphics.endFill()
    }

    tail_ticker = 2
  }

  tail_ticker--
}

const draw = function () {
  if (!running) return

  if (game_over) {
    graphics.beginFill(0x000000, 0.85)
    graphics.drawRect(0, 0, window.innerWidth, window.innerHeight)
    graphics.endFill()
    graphics.addChild(text)
    running = false
  } else {
    gameLogic()
  }

  renderer.render(container)
  requestAnimationFrame(draw)
}

window.onresize = (e) => {
  renderer.view.style.width = window.innerWidth + "px"
  renderer.view.style.height = window.innerHeight + "px"

  renderer.resize(window.innerWidth, window.innerHeight)
}

draw()

