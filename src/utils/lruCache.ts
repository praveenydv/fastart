// High-performance bounded LRU cache to prevent memory bloat
export class LruCache<K, V> extends Map<K, V> {
  private maxSize: number;

  constructor(maxSize: number = 120) {
    super();
    this.maxSize = maxSize;
  }

  override set(key: K, value: V): this {
    if (this.has(key)) {
      this.delete(key);
    } else if (this.size >= this.maxSize) {
      const first = this.keys().next().value;
      if (first !== undefined) this.delete(first);
    }
    super.set(key, value);
    return this;
  }
}
