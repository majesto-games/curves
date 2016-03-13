import { Graphics, Sprite, Texture, autoDetectRenderer, Container, utils, Polygon } from "pixi.js"
import keys from "./keys.js"
import { materialColor, createPolygon, createConnectedPolygon, chunk } from "./util.js"
import p2 from "p2"
import generateName from "sillyname"


const SKIP_TAIL_FATNESS_MULTIPLIER = 0.25
const TAIL_TICKER_DEFAULT = 3
const ROTATION_SPEED = 1
const MOVE_SPEED_BASE = 2
const HOLE_CHANCE_BASE = -0.03
const HOLE_CHANCE_INCREASE = 0.002
const FATNESS_BASE = 20


// Remove pesky pixi.js banner from console
utils._saidHello = true

const renderer = autoDetectRenderer(window.innerWidth, window.innerHeight, { backgroundColor: 0x000000 })



function createPlayerGraphics(point, color) {
  const g = new Graphics()
  g.beginFill(color)
  g.drawCircle(0, 0, 0.5)
  g.position.x = (window.innerWidth - FATNESS_BASE) / 2 + point.x
  g.position.y = (window.innerHeight - FATNESS_BASE) / 2 + point.y
  g.rotation = 0
  g.endFill()
  return g
}

class Player {
  constructor(name, graphics, color, keys) {
    this.name = name
    this.graphics = graphics
    this.color = color
    this.keys = keys
    this.last_x = graphics.x
    this.last_y = graphics.y
    this.fatness = FATNESS_BASE
    this.lfatness = FATNESS_BASE
    this.last_end = null
    this.hole_chance = HOLE_CHANCE_BASE
    this.tail_ticker = 0
    this.speed = MOVE_SPEED_BASE
    this.polygon_tail = []
    this.skip_tail_ticker = 0
  }

  createTail = () => {
    let r = Math.random()
    let pol = null

    if (this.skip_tail_ticker <= 0) {
      if (r < 1 - this.hole_chance) {
        if(this.last_end == null) {
          pol = createPolygon({ x: this.graphics.x, y: this.graphics.y }, { x: this.last_x, y: this.last_y }, this.fatness, this.lfatness)
        } else {
          pol = createConnectedPolygon({ x: this.graphics.x, y: this.graphics.y }, this.fatness, this.last_end, { x: this.last_x, y: this.last_y })
        }

        this.last_end = pol.slice(0, 2).concat(pol.slice(-2))
        this.hole_chance += HOLE_CHANCE_INCREASE
      } else {
        this.skip_tail_ticker = this.fatness * SKIP_TAIL_FATNESS_MULTIPLIER
        this.last_end = null
        this.hole_chance = HOLE_CHANCE_BASE
      }
    } else {
      this.skip_tail_ticker--
    }

    this.last_x = this.graphics.x
    this.last_y = this.graphics.y
    this.lfatness = this.fatness

    return pol
  };
}

const player1Col = materialColor()
const player2Col = materialColor()

const players = [
  new Player(generateName(), createPlayerGraphics({ x: -200, y: 0 }, player1Col), player1Col, { left: keys.A, right: keys.D }),
  new Player(generateName(), createPlayerGraphics({ x: +200, y: 0 }, player2Col), player2Col, { left: keys.LEFT, right: keys.RIGHT }),
]

const container = new Container()

const graphics = new Graphics()

for (let player of players) {
  container.addChild(player.graphics)
}

container.addChild(graphics)

document.getElementById("game").appendChild(renderer.view)

const im = new PIXI.interaction.InteractionManager(renderer)

let running = true

function winnerText (player) {
  const str = player && `${player.name} is the winner!` || "Game draw!"
  const text = new PIXI.Text(str, { font: "64px Impact", fill: player && player.color || "red" })
  text.x = window.innerWidth / 2 - text.width / 2
  text.y = window.innerHeight / 2 - text.height / 2
  return text
}

const gameLogic = () => {

  if(keys.NUM_1.pressed) {
    for (let player of players) {
      player.fatness = 40
    }
  }

  if(keys.NUM_2.pressed) {
    for (let player of players) {
      player.fatness = 20
    }
  }

  if(keys.NUM_3.pressed) {
    for (let player of players) {
      player.speed = 4
    }
  }

  if(keys.NUM_4.pressed) {
    for (let player of players) {
      player.speed = 2
    }
  }

  for (let player of players) {
    player.graphics.x += Math.sin(player.graphics.rotation) * player.speed
    player.graphics.y -= Math.cos(player.graphics.rotation) * player.speed

    if (player.keys.left.pressed) {
      player.graphics.rotation = (player.graphics.rotation - ROTATION_SPEED / player.fatness) % (2 * Math.PI)
    }

    if (player.keys.right.pressed) {
      player.graphics.rotation = (player.graphics.rotation + ROTATION_SPEED / player.fatness) % (2 * Math.PI)
    }

    if (player.graphics.rotation < 0) {
      player.graphics.rotation += 2 * Math.PI
    }

    if (player.graphics.x > window.innerWidth + player.fatness) {
      player.graphics.x = -player.fatness
      player.last_x = player.graphics.x - 1
      player.last_end = null
    }

    if (player.graphics.y > window.innerHeight + player.fatness) {
      player.graphics.y = -player.fatness
      player.last_y = player.graphics.y - 1
      player.last_end = null
    }

    if (player.graphics.x < -player.fatness) {
      player.graphics.x = window.innerWidth + player.fatness
      player.last_x = player.graphics.x + 1
      player.last_end = null
    }

    if (player.graphics.y < -player.fatness) {
      player.graphics.y = window.innerHeight + player.fatness
      player.last_y = player.graphics.y + 1
      player.last_end = null
    }

    player.graphics.scale = { x: player.fatness, y: player.fatness }

    for (let player2 of players) {
      if (player2.polygon_tail.some(poly => poly.contains(player.graphics.x, player.graphics.y))) {
        player.dead = true
      }
    }

    if (player.tail_ticker <= 0) {
      let p = player.createTail()

      if (p !== null) {

        const p_chunks = chunk(p, 2)
        for (let player2 of players) {
          if (player2.polygon_tail.slice(0, -1).some(poly => p_chunks.some(([x, y]) => poly.contains(x, y)))) {
            player.dead = true
          }
        }

        player.polygon_tail.push(new Polygon(p))
        graphics.beginFill(player.color, 1)
        graphics.drawPolygon(p)
        graphics.endFill()
      }

      player.tail_ticker = TAIL_TICKER_DEFAULT
    }

    player.tail_ticker--
  }
}

const draw = function () {
  if (!running) return

  const alive = players.filter(p => !p.dead)


  if (alive.length < 2) {
    graphics.beginFill(0x000000, 0.85)
    graphics.drawRect(0, 0, window.innerWidth, window.innerHeight)
    graphics.endFill()
    graphics.addChild(winnerText(alive[0]))
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

