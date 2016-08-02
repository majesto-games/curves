export enum KEYS {
  CANCEL = 3,
  HELP = 6,
  BACK_SPACE = 8,
  TAB = 9,
  CLEAR = 12,
  RETURN = 13,
  ENTER = 14,
  SHIFT = 16,
  CONTROL = 17,
  ALT = 18,
  PAUSE = 19,
  CAPS_LOCK = 20,
  ESCAPE = 27,
  SPACE = 32,
  PAGE_UP = 33,
  PAGE_DOWN = 34,
  END = 35,
  HOME = 36,
  LEFT = 37,
  UP = 38,
  RIGHT = 39,
  DOWN = 40,
  PRINTSCREEN = 44,
  INSERT = 45,
  DELETE = 46,
  NUM_0 = 48,
  NUM_1 = 49,
  NUM_2 = 50,
  NUM_3 = 51,
  NUM_4 = 52,
  NUM_5 = 53,
  NUM_6 = 54,
  NUM_7 = 55,
  NUM_8 = 56,
  NUM_9 = 57,
  SEMICOLON = 59,
  EQUALS = 61,
  A = 65,
  B = 66,
  C = 67,
  D = 68,
  E = 69,
  F = 70,
  G = 71,
  H = 72,
  I = 73,
  J = 74,
  K = 75,
  L = 76,
  M = 77,
  N = 78,
  O = 79,
  P = 80,
  Q = 81,
  R = 82,
  S = 83,
  T = 84,
  U = 85,
  V = 86,
  W = 87,
  X = 88,
  Y = 89,
  Z = 90,
  CONTEXT_MENU = 93,
  NUMPAD_0 = 96,
  NUMPAD_1 = 97,
  NUMPAD_2 = 98,
  NUMPAD_3 = 99,
  NUMPAD_4 = 100,
  NUMPAD_5 = 101,
  NUMPAD_6 = 102,
  NUMPAD_7 = 103,
  NUMPAD_8 = 104,
  NUMPAD_9 = 105,
  MULTIPLY = 106,
  ADD = 107,
  SEPARATOR = 108,
  SUBTRACT = 109,
  DECIMAL = 110,
  DIVIDE = 111,
  F1 = 112,
  F2 = 113,
  F3 = 114,
  F4 = 115,
  F5 = 116,
  F6 = 117,
  F7 = 118,
  F8 = 119,
  F9 = 120,
  F10 = 121,
  F11 = 122,
  F12 = 123,
  F13 = 124,
  F14 = 125,
  F15 = 126,
  F16 = 127,
  F17 = 128,
  F18 = 129,
  F19 = 130,
  F20 = 131,
  F21 = 132,
  F22 = 133,
  F23 = 134,
  F24 = 135,
  NUM_LOCK = 144,
  SCROLL_LOCK = 145,
  COMMA = 188,
  PERIOD = 190,
  SLASH = 191,
  BACK_QUOTE = 192,
  OPEN_BRACKET = 219,
  BACK_SLASH = 220,
  CLOSE_BRACKET = 221,
  QUOTE = 222,
  META = 224,
}

interface PressedKeys {
  [key: number]: boolean
}


const keys: PressedKeys = {
}

export function registerKeys(keysToRegister: KEYS[]) {
  keysToRegister.forEach(element => {
    keys[element] = keys[element] || false
  })
}

export default (() => {
  function setKeysPressed (e: KeyboardEvent, pressed: boolean) {
    if (e.metaKey || e.ctrlKey || e.altKey || e.target !== document.body) {
      return
    }

    const key = keys[e.keyCode]
    if (key != null && key !== pressed) {
      e.preventDefault()

      keys[e.keyCode] = pressed
    }
  }

  window.addEventListener("keydown", (e) => {
    setKeysPressed(e, true)
  })

  window.addEventListener("keyup", (e) => {
    setKeysPressed(e, false)
  })

  return keys
})()
