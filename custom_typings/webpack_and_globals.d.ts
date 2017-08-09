declare var process: {
  env: {
    NODE_ENV: "production" | "development"
  }
}

declare var BUILDTIME: number

interface Window {
  __REDUX_DEVTOOLS_EXTENSION__: any,
}

declare module "*.png" {
  const value: string;
  export = value;
}

declare module "*.svg" {
  const value: string;
  export = value;
}

declare var require: {
  <T>(path: string): T
  (paths: string[], callback: (...modules: any[]) => void): void
  ensure: (paths: string[], callback: (require: <T>(path: string) => T) => void) => void
}
