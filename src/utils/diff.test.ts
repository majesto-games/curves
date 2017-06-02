
import diff, { equal, similar, ChangeSet, ChangeRm, ChangeAdd } from "utils/diff"

const odiff = Object.assign(function(a: any, b: any) {
  return diff(a, b)
}, {
    equal,
    similar,
  })

const unit: any = require("deadunit/deadunit.browser")

// tslint:disable:no-shadowed-variable
const test = unit.test("Testing odiff", function(this: any) {

  this.test("simple value test", function(this: any) {
    const diffs = odiff(1, 2)
    this.eq(diffs.length, 1)

    const d = diffs[0] as ChangeSet<any>
    this.eq(d.type, "set")
    this.ok(odiff.equal(d.path, []), d.path, [])
    this.eq(d.val, 2)
  })
  this.test("simple value test - strong equality", function(this: any) {
    const diffs = odiff("", 0)
    this.eq(diffs.length, 1)

    const d = diffs[0] as ChangeSet<any>
    this.eq(d.type, "set")
    this.ok(odiff.equal(d.path, []), d.path, [])
    this.eq(d.val, 0)
  })
  this.test("NaN test", function(this: any) {
    const a = { x: NaN }
    const b = { x: NaN }

    const diffs = odiff(a, b)
    this.eq(diffs.length, 0)
  })

  this.test("simple object diff", function(this: any) {
    const a = { a: 1, b: 2, c: 3 }
    const b = { a: 1, b: 2, d: 3 }

    const diffs = odiff(a, b)

    this.eq(diffs.length, 2)

    let d = diffs[0] as ChangeSet<any>
    this.eq(d.type, "set")
    this.ok(odiff.equal(d.path, ["c"]), d.path, ["c"])
    this.eq(d.val, undefined)

    d = diffs[1] as ChangeSet<any>
    this.eq(d.type, "set")
    this.ok(odiff.equal(d.path, ["d"]), d.path, ["d"])
    this.eq(d.val, 3)
  })
  this.test("simple array diff - rm", function(this: any) {
    const a = [1, 2, 3]
    const b: any[] = []

    const diffs = odiff(a, b)
    this.eq(diffs.length, 1)

    const d = diffs[0] as ChangeRm
    this.eq(d.type, "rm")
    this.eq(d.path!.length, 0)
    this.eq(d.index, 0)
    this.eq(d.num, 3)
  })
  this.test("simple array diff - add", function(this: any) {
    const a: any[] = []
    const b = [1, 2, 3]

    const diffs = odiff(a, b)
    this.eq(diffs.length, 1)

    const d = diffs[0] as ChangeAdd<any>
    this.eq(d.type, "add")
    this.eq(d.path!.length, 0)
    this.eq(d.index, 0)
    this.ok(odiff.equal(d.vals, [1, 2, 3]), d.vals, [1, 2, 3])
  })
  this.test("simple array diff - change", function(this: any) {
    const a = [1, 2, 3]
    const b = [1, 2, 4]

    const diffs = odiff(a, b)
    this.eq(diffs.length, 1)

    const d = diffs[0] as ChangeSet<any>
    this.eq(d.type, "set")
    this.ok(odiff.equal(d.path, [2]), d.path, [2])
    this.eq(d.val, 4)
  })
  this.test("array diff - added one, then removed one", function(this: any) {
    const a = [1, 2, 3, 4, 5]
    const b = [1, 1.1, 2, 3, 5]

    const diffs = odiff(a, b)
    this.eq(diffs.length, 2)

    const d0 = diffs[0] as ChangeRm
    this.eq(d0.type, "rm")
    this.eq(d0.path!.length, 0)
    this.eq(d0.index, 3)
    this.eq(d0.num, 1)

    const d1 = diffs[1] as ChangeAdd<any>
    this.eq(d1.type, "add")
    this.eq(d1.path!.length, 0)
    this.eq(d1.index, 1)
    this.ok(odiff.equal(d1.vals, [1.1]), d1.vals, [1.1])
  })
  this.test("complex array diff", function(this: any) {
    const a = [{ a: 1, b: 2, c: 3 }, { x: 1, y: 2, z: 3 }, { w: 9, q: 8, r: 7 }]
    const b = [{ a: 1, b: 2, c: 3 }, { t: 4, y: 5, u: 6 },
    { x: 1, y: "3", z: 3 }, { t: 9, y: 9, u: 9 }, { w: 9, q: 8, r: 7 }]

    const diffs = odiff(a, b)
    this.eq(diffs.length, 3)

    const d0 = diffs[0] as ChangeAdd<any>
    this.eq(d0.type, "add")
    this.eq(d0.path!.length, 0)
    this.eq(d0.index, 2)
    this.ok(odiff.equal(d0.vals, [{ t: 9, y: 9, u: 9 }]))

    const d1 = diffs[1] as ChangeSet<any>
    this.eq(d1.type, "set")
    this.ok(odiff.equal(d1.path, [1, "y"]), d1.path, [1, "y"])
    this.eq(d1.val, "3")

    const d2 = diffs[2] as ChangeAdd<any>
    this.eq(d2.type, "add")
    this.eq(d2.path!.length, 0)
    this.eq(d2.index, 1)
    this.ok(odiff.equal(d2.vals, [{ t: 4, y: 5, u: 6 }]), d2.vals, [{ t: 4, y: 5, u: 6 }])
  })
  this.test("complex array diff - distinguish set and add", function(this: any) {
    const a = [{ a: 1, b: 2 }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]
    const b = [{ a: 1, b: 2 }, { a: 9, b: 8 }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]

    const diffs = odiff(a, b)
    this.eq(diffs.length, 1)

    const d = diffs[0] as ChangeAdd<any>
    this.eq(d.type, "add")
    this.eq(d.path!.length, 0)
    this.eq(d.index, 1)
    this.ok(odiff.equal(d.vals, [{ a: 9, b: 8 }]), d.vals, [{ a: 9, b: 8 }])
  })
  this.test("complex array diff - distinguish set and rm", function(this: any) {
    const a = [{ a: 1, b: 2 }, { a: 9, b: 8 }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]
    const b = [{ a: 1, b: 2 }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]

    const diffs = odiff(a, b)
    this.eq(diffs.length, 1)

    const d = diffs[0] as ChangeRm
    this.eq(d.type, "rm")
    this.eq(d.path!.length, 0)
    this.eq(d.index, 1)
    this.eq(d.num, 1)
  })

  this.test("complex array diff - change then add", function(this: any) {
    const a = [{ a: 1, b: 2 }, { a: 9, b: 8 }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]
    const b = [{ a: 1, b: 2 }, { a: 9, b: "7" }, { a: 8, b: 1 }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]

    const diffs = odiff(a, b)
    this.eq(diffs.length, 2)

    const d0 = diffs[0] as ChangeAdd<any>
    this.eq(d0.type, "add")
    this.eq(d0.path!.length, 0)
    this.eq(d0.index, 2)
    this.ok(odiff.equal(d0.vals, [{ a: 8, b: 1 }]))

    const d1 = diffs[1] as ChangeSet<any>
    this.eq(d1.type, "set")
    this.ok(odiff.equal(d1.path, [1, "b"]), d1.path, [1, "b"])
    this.eq(d1.val, "7")
  })
  this.test("complex array diff - add then change", function(this: any) {
    const a = [{ a: 1, b: 2 }, { a: 9, b: 8 }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]
    const b = [{ a: 1, b: 2 }, { a: 8, b: 1 }, { a: 9, b: "7" }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]

    const diffs = odiff(a, b)
    this.eq(diffs.length, 2)

    const d0 = diffs[0] as ChangeSet<any>
    this.eq(d0.type, "set")
    this.ok(odiff.equal(d0.path, [1, "b"]), d0.path, [1, "b"])
    this.eq(d0.val, "7")

    const d1 = diffs[1] as ChangeAdd<any>
    this.eq(d1.type, "add")
    this.eq(d1.path!.length, 0)
    this.eq(d1.index, 1)
    this.ok(odiff.equal(d1.vals, [{ a: 8, b: 1 }]))
  })

  this.test("complex array diff - change then remove", function(this: any) {
    const a = [{ a: 1, b: 2 }, { a: 9, b: 8 }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]
    const b = [{ a: 1, b: 2 }, { a: 9, b: "7" }, { a: 5, b: 6 }, { a: 7, b: 8 }]

    const diffs = odiff(a, b)
    this.eq(diffs.length, 2)

    const d0 = diffs[0] as ChangeRm
    this.eq(d0.type, "rm")
    this.eq(d0.path!.length, 0)
    this.eq(d0.index, 2)
    this.eq(d0.num, 1)

    const d1 = diffs[1] as ChangeSet<any>
    this.eq(d1.type, "set")
    this.ok(odiff.equal(d1.path, [1, "b"]), d1.path, [1, "b"])
    this.eq(d1.val, "7")
  })
  this.test("complex array diff - remove then change", function(this: any) {
    const a = [{ a: 1, b: 2 }, { a: 9, b: 8 }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]
    const b = [{ a: 9, b: "7" }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]

    const diffs = odiff(a, b)
    this.eq(diffs.length, 2)

    const d0 = diffs[0] as ChangeSet<any>
    this.eq(d0.type, "set")
    this.ok(odiff.equal(d0.path, [1, "b"]), d0.path, [1, "b"])
    this.eq(d0.val, "7")

    const d1 = diffs[1] as ChangeRm
    this.eq(d1.type, "rm")
    this.eq(d1.path!.length, 0)
    this.eq(d1.index, 0)
    this.eq(d1.num, 1)
  })

  this.test("complex array diff - move", function(this: any) {

    const a = [{ a: 1, b: 2 }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }, { a: 9, b: 10 }]
    const b = [{ a: 1, b: 2 }, { a: 5, b: 6 }, { a: 7, b: 8 }, { a: 3, b: 4 }, { a: 9, b: 10 }]

    const diffs = odiff(a, b)
    this.eq(diffs.length, 2)

    const d0 = diffs[0] as ChangeAdd<any>
    this.eq(d0.type, "add")
    this.eq(d0.path!.length, 0)
    this.eq(d0.index, 4)
    this.ok(odiff.equal(d0.vals, [{ a: 3, b: 4 }]))

    const d1 = diffs[1] as ChangeRm
    this.eq(d1.type, "rm")
    this.eq(d1.path!.length, 0)
    this.eq(d1.index, 1)
    this.eq(d1.num, 1)
  })

  this.test("complex array diff - add then change similar", function(this: any) {
    const a = [{ a: 1, b: 2 }, { a: 9, b: 8 }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]
    const b = [{ a: 1, b: 2 }, { a: "8", b: 8 }, { a: 7, b: 2 }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]

    const diffs = odiff(a, b)
    this.eq(diffs.length, 2)

    const d0 = diffs[0] as ChangeAdd<any>
    this.eq(d0.type, "add")
    this.eq(d0.path!.length, 0)
    this.eq(d0.index, 2)
    this.ok(odiff.equal(d0.vals, [{ a: 7, b: 2 }]))

    const d1 = diffs[1] as ChangeSet<any>
    this.eq(d1.type, "set")
    this.ok(odiff.equal(d1.path, [1, "a"]), d1.path, [1, "a"])
    this.eq(d1.val, "8")
  })
  this.test("complex array diff - remove then change similar", function(this: any) {
    const a = [{ a: 9, b: 2 }, { a: 7, b: 4 }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]
    const b = [{ a: 9, b: "7" }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]

    const diffs = odiff(a, b)
    this.eq(diffs.length, 2)

    const d0 = diffs[0] as ChangeRm
    this.eq(d0.type, "rm")
    this.eq(d0.path!.length, 0)
    this.eq(d0.index, 1)
    this.eq(d0.num, 1)

    const d1 = diffs[1] as ChangeSet<any>
    this.eq(d1.type, "set")
    this.ok(odiff.equal(d1.path, [0, "b"]), d1.path, [0, "b"])
    this.eq(d1.val, "7")
  })
  this.test("complex array diff - set two in a row", function(this: any) {
    const a = [{ a: 9, b: 2 }, { a: 3, b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]
    const b = [{ a: 9, b: "7" }, { a: "4", b: 4 }, { a: 5, b: 6 }, { a: 7, b: 8 }]

    const diffs = odiff(a, b)
    this.eq(diffs.length, 2)

    const d0 = diffs[0] as ChangeSet<any>
    this.eq(d0.type, "set")
    this.ok(odiff.equal(d0.path, [1, "a"]), d0.path, [1, "a"])
    this.eq(d0.val, "4")

    const d1 = diffs[1] as ChangeSet<any>
    this.eq(d1.type, "set")
    this.ok(odiff.equal(d1.path, [0, "b"]), d1.path, [0, "b"])
    this.eq(d1.val, "7")
  })

  this.test("deep diff test", function(this: any) {
    const a = {
      x: [1, 2, 3],
      y: {
        z: [
          { a: 1, b: 2 },
          { c: 3, d: 4 },
        ],
        aa: [
          [1, 2, 3],
          [5, 6, 7],
        ],
      },
    }
    const b = {
      x: [1, 2, 4],
      y: {
        z: [
          { a: 1, b: 3 },
          { c: 3, d: 4 },
        ],
        aa: [
          [1, 2, 3],
          [9, 8],
          [5, 6.2, 7],
        ],
      },
    }

    const diffs = odiff(a, b)
    this.eq(diffs.length, 4)

    const d0 = diffs[0] as ChangeSet<any>
    this.eq(d0.type, "set")
    this.ok(odiff.equal(d0.path, ["x", 2]), d0.path, ["x", 2])
    this.eq(d0.val, 4)

    const d1 = diffs[1] as ChangeSet<any>
    this.eq(d1.type, "set")
    this.ok(odiff.equal(d1.path, ["y", "z", 0, "b"]), d1.path, ["y", "z", 0, "b"])
    this.eq(d1.val, 3)

    const d2 = diffs[2] as ChangeSet<any>
    this.eq(d2.type, "set")
    this.ok(odiff.equal(d2.path, ["y", "aa", 1, 1]), d2.path, ["y", "aa", 1, 1])
    this.eq(d2.val, 6.2)

    const d3 = diffs[3] as ChangeAdd<any>
    this.eq(d3.type, "add")
    this.ok(odiff.equal(d3.path, ["y", "aa"]), d3.path, ["y", "aa"])
    this.eq(d3.index, 1)
    this.ok(odiff.equal(d3.vals, [[9, 8]]))
  })

  this.test("former bugs", function(this: any) {
    this.test("missing diff", function(this: any) {
      const a = { b: [1, { x: "y", e: 1 }] }
      const b = { b: [1, { x: "z", e: 1 }, 5] }

      const diffs = odiff(a, b)
      this.eq(diffs.length, 2)

      const d0 = diffs[0] as ChangeAdd<any>
      this.eq(d0.type, "add")
      this.ok(odiff.equal(d0.path, ["b"]), d0.path, ["b"])
      this.eq(d0.index, 2)
      this.ok(odiff.equal(d0.vals, [5]), d0.vals, [5])

      const d1 = diffs[1] as ChangeSet<any>
      this.eq(d1.type, "set")
      this.ok(odiff.equal(d1.path, ["b", 1, "x"]), d1.path, ["b", 1, "x"])
      this.eq(d1.val, "z")
    })
  })

})

test.writeHtml(document.getElementById("content"))
