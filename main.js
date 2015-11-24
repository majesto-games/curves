import { Graphics, Sprite, Texture, autoDetectRenderer, Container, utils } from 'pixi.js'
import keys from './keys.js' 
import p2 from 'p2'

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

const c = new Container()

const graphics = new Graphics()

document.getElementById('game').appendChild(renderer.view)

const rotationSpeed = 0.05
const moveSpeed = 4
const keydown = { left: false, right: false }

let fatness = 5
let trail = []
let line = new Graphics()
let tail = new Graphics()
c.addChild(line)
c.addChild(tail)
line.lineStyle(fatness, 0xffff00)
tail.lineStyle(fatness, 0xffffff)
line.moveTo(player.x, player.y)
tail.moveTo(player.x, player.y)

function funColor () {
  return superFunColor(((0x80 + Math.random() * 0x80) << 16) | ((0x80 + Math.random() * 0x80) << 8) | ((0x80 + Math.random() * 0x80)))
}

function superFunColor (input) {
  let choices = [0xff00ff, 0xffff00, 0x00ffff, 0x0000ff, 0x00ff00, 0xff0000]

  return input & choices[Math.floor(Math.random() * choices.length)]
}

let lx = player.x
let ly = player.y
let color = funColor()

console.log(color.toString(16))

function createTrailPoint (x, y) {
  let r = Math.random()

  if (r < 0.9) {
    line.lineStyle(fatness, color)
    line.moveTo(lx, ly)
    line.lineTo(x, y)
  }

  lx = x
  ly = y

  color = funColor()
}

c.addChild(player)

let trailCounter = 0

const draw = function () {
  player.x += Math.sin(player.rotation) * moveSpeed
  player.y -= Math.cos(player.rotation) * moveSpeed

  if (keys.left.pressed)
    player.rotation = (player.rotation - rotationSpeed) % (2 * Math.PI)

  if (keys.right.pressed)
    player.rotation = (player.rotation + rotationSpeed) % (2 * Math.PI)

  if (keys.up.pressed)
    fatness += 0.1

  if (keys.down.pressed)
    fatness -= 0.1

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

  tail.clear()
  tail.lineStyle(fatness, color)
  tail.moveTo(player.x, player.y)
  tail.lineTo(lx, ly)

  if (trailCounter <= 0) {
    // let x = player.x - Math.sin(player.rotation) * 64
    // let y = player.y + Math.cos(player.rotation) * 64
    createTrailPoint(player.x, player.y)
    trailCounter = Math.floor(fatness)
  }

  trailCounter--

  renderer.render(c)
  requestAnimationFrame(draw)
}

window.onresize = (e) => {
  renderer.view.style.width = window.innerWidth + 'px'
  renderer.view.style.height = window.innerHeight + 'px'

  renderer.resize(window.innerWidth, window.innerHeight)
}

draw()

