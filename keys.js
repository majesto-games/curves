import R from 'Ramda'

const keys = {
  left: { code: 37, pressed: false },
  right: { code: 39, pressed: false },
  up: { code: 38, pressed: false },
  down: { code: 40, pressed: false }
}

module.exports = (() => {
  function setKeysPressed (e, pressed) {
    R.mapObjIndexed((key) => {
      if (key.code === e.keyCode) {
        e.preventDefault()

        key.pressed = pressed
      }

      return key
    }, keys)
  }

  window.addEventListener('keydown', (e) => {
    setKeysPressed(e, true)
  })

  window.addEventListener('keyup', (e) => {
    setKeysPressed(e, false)
  })

  return keys
})()

