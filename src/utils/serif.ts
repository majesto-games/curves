export interface DehydratedFunction {
  type: string
  payload: any
}

export class FunctionProvider<P, R> {
  private providers: { [key: string]: (t: any) => (p: P) => R } = {}

  public register(f: (t: any) => (p: P) => R) {
    if (process.env.NODE_ENV !== "production") {
      const f2 = this.providers[f.name]
      if (f2 != null) {
        throw new Error(`texture provider (${f.name}) already registered`)
      }
    }
    this.providers[f.name] = f
  }

  public dehydrate<T>(f: (t: T) => (p: P) => R, t: T): DehydratedFunction {
    if (process.env.NODE_ENV !== "production") {
      const f2 = this.providers[f.name]
      if (f2 == null) {
        throw new Error(`texture provider (${f.name}) not registered`)
      }
    }
    return {
      type: f.name,
      payload: t,
    }
  }

  public getF<T>(df: DehydratedFunction): (p: P) => R {
    const f = this.providers[df.type]
    if (process.env.NODE_ENV !== "production") {
      if (f == null) {
        throw new Error(`texture provider (${df.type}) not registered`)
      }
    }
    return f(df.payload)
  }
}

export class FunctionProviderUndefined<R> {
  private providers: { [key: string]: (t: any) => R } = {}

  public register(f: (t: any) => R) {
    if (process.env.NODE_ENV !== "production") {
      const f2 = this.providers[f.name]
      if (f2 != null) {
        throw new Error(`texture provider (${f.name}) already registered`)
      }
    }
    this.providers[f.name] = f
  }

  public dehydrate<T>(f: (t: T) => R, t: T): DehydratedFunction {
    if (process.env.NODE_ENV !== "production") {
      const f2 = this.providers[f.name]
      if (f2 == null) {
        throw new Error(`texture provider (${f.name}) not registered`)
      }
    }
    return {
      type: f.name,
      payload: t,
    }
  }

  public getF(df: DehydratedFunction): R {
    const f = this.providers[df.type]
    if (process.env.NODE_ENV !== "production") {
      if (f == null) {
        throw new Error(`texture provider (${df.type}) not registered`)
      }
    }
    return f(df.payload)
  }
}
