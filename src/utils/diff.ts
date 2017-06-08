
import { arrayToMap, Key } from "utils/array"

export type Path = (string | number)[]

export interface ChangeAdd<T> {
  type: "add"
  path: Path
  vals: T[]
  index: number
}

export interface ChangeSet<T> {
  type: "set"
  path: Path
  val: T
}

export interface ChangeRm {
  type: "rm"
  path: Path
  num: number
  index: number
}

export interface ChangeMod<T> {
  type: "mod"
  path: Path
  from: T
  to: T
}

export type RecursiveChange = Change<any>

/* Copyright (c) 2013 Billy Tetrud - Free to use for any purpose: MIT License*/
export default function diffRecursive(a: any, b: any) {
  const results: RecursiveChange[] = []
  diffInternal(a, b, results, [])
  return results
}

export type Change<T> = ChangeAdd<T> | ChangeSet<T> | ChangeRm
export function diff<T>(a: T, B: T) {
  return
}

function diffInternal(a: any, b: any, acc: RecursiveChange[], base: (string | number)[]) {
  if (a === b || Number.isNaN(a) && Number.isNaN(b)) {
    return
  } else if (a instanceof Array && b instanceof Array) {

    const diffs = diffArray(a, b)

    diffs.forEach(v => {
      if (v.type === "mod") {
        diffInternal(v.from, v.to, acc, base.concat(v.path))
      } else {
        v.path = base.concat(v.path)
        acc.push(v)
      }
    })

  } else if (a instanceof Object && b instanceof Object) {
    const diffs = diffObject(a, b)
    diffs.forEach(([key, ac, bc]) => {
      const path = base.concat(key)
      diffInternal(a[key], b[key], acc, path)
    })
  } else {
    set(acc, base, b)
  }

}

type ObjectDiff<T, K extends keyof T> = [K, T[K], T[K]]

export function diffObject<T>(a: T, b: T) {
  const acc: ObjectDiff<T, keyof T>[] = []
  const keyMap = Object.assign(
    arrayToMap<T>(Object.keys(a) as Key<T>[]),
    arrayToMap<T>(Object.keys(b) as Key<T>[]))

  for (const key in keyMap) {
    // tslint:disable:forin
    // tslint:enable
    acc.push([key, a[key], b[key]])
  }

  return acc
}

export type ArrayDiff<T> = ChangeAdd<T> | ChangeSet<T> | ChangeRm | ChangeMod<T>

export function diffArray<T>(a: T[], b: T[]) {
  const acc: ArrayDiff<T>[] = []
  let an = a.length - 1
  let bn = b.length - 1
  while (an >= 0 && bn >= 0) {     // loop backwards (so that making changes in order will work correctly)
    if (!equal(a[an], b[bn])) {
      const indexes = findMatchIndexes(equal, a, b, an, bn, 0, 0)

      let anInner = an
      let bnInner = bn
      while (anInner > indexes.a && bnInner > indexes.b) {
        if (similar(a[anInner], b[bnInner])) {
          // get change for that element
          modify<T>(acc, [anInner], a[anInner], b[bnInner])
          anInner--
          bnInner--
        } else {
          const indexesInner = findMatchIndexes(similar, a, b, anInner, bnInner, indexes.a + 1, indexes.b + 1)

          const numberPulled = anInner - indexesInner.a
          const numberPushed = bnInner - indexesInner.b

          if (numberPulled === 1 && numberPushed === 1) {
            set(acc, [indexesInner.a + 1], b[indexesInner.b + 1]) // set the one
          } else if (numberPulled === 1 && numberPushed === 2) {
            // set one, push the other
            add(acc, [], indexesInner.a + 2, b.slice(indexesInner.b + 2, bnInner + 1))
            set(acc, [indexesInner.a + 1], b[indexesInner.b + 1])
          } else if (numberPulled === 2 && numberPushed === 1) {
            // set one, pull the other
            rm(acc, [], indexesInner.a + 2, 1)
            set(acc, [indexesInner.a + 1], b[indexesInner.b + 1])
          } else if (numberPulled === 2 && numberPushed === 2) {
            set(acc, [indexesInner.a + 2], b[indexesInner.b + 2])
            set(acc, [indexesInner.a + 1], b[indexesInner.b + 1])
          } else {
            if (numberPulled > 0) { // if there were some elements pulled
              rm(acc, [], indexesInner.a + 1, numberPulled)
            }
            if (numberPushed > 0) { // if there were some elements pushed
              add(acc, [], indexesInner.a + 1, b.slice(indexesInner.b + 1, bnInner + 1))
            }
          }

          anInner = indexesInner.a
          bnInner = indexesInner.b
        }
      }

      if (anInner > indexes.a) {        // more to pull
        rm(acc, [], anInner, anInner - indexes.a)
      } else if (bnInner > indexes.b) { // more to push
        add(acc, [], anInner + 1, b.slice(indexes.b + 1, bnInner + 1))
      }

      an = indexes.a
      bn = indexes.b
    } else {
      an--
      bn--
    }
  }

  if (an >= 0) {        // more to pull
    rm(acc, [], 0, an + 1)
  } else if (bn >= 0) { // more to push
    add(acc, [], 0, b.slice(0, bn + 1))
  }

  return acc
}
// adds an 'set' type to the changeList
function set<T>(changeList: ArrayDiff<T>[], path: Path, value: T): void
function set<T>(changeList: Change<T>[], path: Path, value: T) {
  changeList.push({
    type: "set",
    path,
    val: value,
  })
}

// adds an 'rm' type to the changeList
function rm<T>(changeList: ArrayDiff<T>[], path: Path, index: number, count: number): void
function rm<T>(changeList: Change<T>[], path: Path, index: number, count: number) {
  changeList.push({
    type: "rm",
    path,
    index,
    num: count,
  })
}

// adds an 'add' type to the changeList
function add<T>(changeList: ArrayDiff<T>[], path: Path, index: number, values: T[]): void
function add<T>(changeList: Change<T>[], path: Path, index: number, values: T[]) {
  changeList.push({
    type: "add",
    path,
    index,
    vals: values,
  })
}

function modify<T>(changeList: ArrayDiff<T>[], path: Path, from: T, to: T) {
  changeList.push({
    type: "mod",
    path,
    from,
    to,
  })
}

// finds and returns the closest indexes in a and b that match starting with divergenceIndex
// note: loops backwards like the rest of this stuff
// returns the index beyond the first element (aSubMin-1 or bSubMin-1) for each if there is no match
// parameters:
// compareFn - determines what matches (returns true if the arguments match)
// a,b - two arrays to compare
// divergenceIndexA,divergenceIndexB - the two positions of a and b to start comparing from
// aSubMin,bSubMin - the two positions to compare until
function findMatchIndexes(
  compareFn: (a: any, b: any) => boolean,
  a: any, b: any, divergenceIndexA: number, divergenceIndexB: number,
  aSubMin: number, bSubMin: number) {
  const maxNForA = divergenceIndexA - aSubMin
  const maxNForB = divergenceIndexB - bSubMin
  const maxN = Math.max(maxNForA, maxNForB)
  for (let n = 1; n <= maxN; n++) {
    const newestA = a[divergenceIndexA - n] // the current item farthest from the divergence index being compared
    const newestB = b[divergenceIndexB - n]

    if (n <= maxNForB && n <= maxNForA && compareFn(newestA, newestB)) {
      return { a: divergenceIndexA - n, b: divergenceIndexB - n }
    }

    for (let j = 0; j < n; j++) {
      const elemA = a[divergenceIndexA - j] // an element between the divergence index and the newest items
      const elemB = b[divergenceIndexB - j]

      if (n <= maxNForB && compareFn(elemA, newestB)) {
        return { a: divergenceIndexA - j, b: divergenceIndexB - n }
      } else if (n <= maxNForA && compareFn(newestA, elemB)) {
        return { a: divergenceIndexA - n, b: divergenceIndexB - j }
      }
    }
  }
  // else
  return { a: aSubMin - 1, b: bSubMin - 1 }
}

// compares arrays and objects and returns true if they're similar meaning:
// less than 2 changes, or
// less than 10% different members
export function similar(a: any, b: any) {
  if (a instanceof Array) {
    if (!(b instanceof Array)) {
      return false
    }

    const tenPercent = a.length / 10
    let notEqual = Math.abs(a.length - b.length) // initialize with the length difference
    for (let n = 0; n < a.length; n++) {
      if (equal(a[n], b[n])) {
        if (notEqual >= 2 && notEqual > tenPercent || notEqual === a.length) {
          return false
        }

        notEqual++
      }
    }
    // else
    return true

  } else if (a instanceof Object) {
    if (!(b instanceof Object)) {
      return false
    }

    const keyMap = Object.assign(arrayToMap(Object.keys(a)), arrayToMap(Object.keys(b)))
    const keyLength = Object.keys(keyMap).length
    const tenPercent = keyLength / 10
    let notEqual = 0
    for (const key in keyMap) {
      // tslint:disable:forin
      // tslint:enable
      const aVal = a[key]
      const bVal = b[key]

      if (!equal(aVal, bVal)) {
        if (notEqual >= 2 && notEqual > tenPercent || notEqual + 1 === keyLength) {
          return false
        }

        notEqual++
      }
    }
    // else
    return true

  } else {
    return a === b || Number.isNaN(a) && Number.isNaN(b)
  }
}

// compares arrays and objects for value equality (all elements and members must match)
export function equal(a: any, b: any) {
  if (a instanceof Array) {
    if (!(b instanceof Array)) {
      return false
    }
    if (a.length !== b.length) {
      return false
    } else {
      for (let n = 0; n < a.length; n++) {
        if (!equal(a[n], b[n])) {
          return false
        }
      }
      // else
      return true
    }
  } else if (a instanceof Object) {
    if (!(b instanceof Object)) {
      return false
    }

    const aKeys = Object.keys(a)
    const bKeys = Object.keys(b)

    if (aKeys.length !== bKeys.length) {
      return false
    } else {
      for (const key of aKeys) {
        const aVal = a[key]
        const bVal = b[key]

        if (!equal(aVal, bVal)) {
          return false
        }
      }
      // else
      return true
    }
  } else {
    return a === b || Number.isNaN(a) && Number.isNaN(b)
  }
}
