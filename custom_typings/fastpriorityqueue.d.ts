declare module "fastpriorityqueue" {
  export = PriorityQueue;

  class PriorityQueue<T> {
    constructor(comparator?: (a: T, b: T) => boolean);

    add(myval: T): void;

    heapify(arr: T[]): void;

    isEmpty(): boolean;

    peek(): T | undefined;

    poll(): T | undefined;

    trim(): void;
  }
}
