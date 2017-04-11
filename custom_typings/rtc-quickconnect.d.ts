declare module "rtc-quickconnect" {
  function quickconnect(signalhost: any, opts?: any): quickconnect.connection;

  export = quickconnect;

  namespace quickconnect {
    export interface connection {
      attributes: {
        agent: string;
        browser: string;
        browserVersion: string;
        id: string;
      };

      autoreply: boolean;

      id: string;

      parent: string;

      plugins: any[];

      addListener(name: any, handler: any): any;

      addStream(stream: any): any;

      announce(data: any): any;

      broadcast(stream: any): any;

      clear(name: any): void;

      close(): void;

      connect(): any;

      createDataChannel(label: any, opts?: any): any;

      endCall(id: any): void;

      endCalls(): void;

      feed(handler: any): any;

      get(name: any): any;

      getLocalStreams(): any;

      getScheme(id: any, canDefault: any): any;

      isMaster(targetId: any): any;

      join(): void;

      leave(): void;

      off(name: any, handler: any): void;

      on(name: any, handler: any): any;

      once(name: any, handler: any, ...args: any[]): any;

      profile(data: any): any;

      reactive(): any;

      reconnectTo(id: any, reconnectOpts?: any): any;

      registerScheme(scheme: any): void;

      removeAllListeners(name: any): void;

      removeListener(name: any, handler: any): void;

      removeStream(stream: any): any;

      requestChannel(targetId: any, label: any, callback: any): any;

      requestStream(targetId: any, idx: any, callback: any): any;

      send(...args: any[]): void;

      to(targetId: any): any;

      waitForCall(targetId: any, callback: any): any;
    }

    export interface calls {
      abort(id: any): void;

      create(id: any, pc: any, data: any): any;

      end(id: any): void;

      fail(id: any): void;

      failing(id: any): void;

      get(key: any): any;

      keys(): any;

      ping(sender: any): void;

      recovered(id: any): void;

      remove(key: any): any;

      set(key: any, value: any): void;

      start(id: any, pc: any, data: any): any;

      values(): any;

    }

    export interface peers {
      get(key: any): any;

      keys(): any;

      remove(key: any): any;

      set(key: any, value: any): void;

      values(): any;

    }
  }
}
