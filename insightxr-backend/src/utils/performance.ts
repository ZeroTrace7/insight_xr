/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Performance Utilities for Insight XR
 */

// ===================================
// 1. DEBOUNCING & THROTTLING
// ===================================

/**
 * Debounce function calls (waits until user stops typing/interacting)
 */
export function debounce<T extends (...args: any[]) => any>(
    func: T,
    delay: number
): (...args: Parameters<T>) => void {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function (this: any, ...args: Parameters<T>) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
}

/**
 * Throttle function calls (limits execution rate)
 */
export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    return function (this: any, ...args: Parameters<T>) {
        if (!inThrottle) {
            func.apply(this, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
}

// ===================================
// 2. IMAGE LOADING & CACHING
// ===================================

/**
 * Preload images for better performance
 */
export function preloadImages(urls: string[]): Promise<void[]> {
    const promises = urls.map(url => {
        return new Promise<void>((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
            img.src = url;
        });
    });
    return Promise.all(promises);
}

/**
 * Lazy load images when they enter viewport
 */
export function setupLazyLoading(): void {
    if ('IntersectionObserver' in window) {
        const imageObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target as HTMLImageElement;
                    const src = img.dataset.src;
                    if (src) {
                        img.src = src;
                        img.removeAttribute('data-src');
                        imageObserver.unobserve(img);
                    }
                }
            });
        });

        document.querySelectorAll('img[data-src]').forEach(img => {
            imageObserver.observe(img);
        });
    }
}

// ===================================
// 3. LOCAL STORAGE CACHING
// ===================================

interface CacheItem<T> {
    data: T;
    timestamp: number;
    ttl: number; // Time to live in milliseconds
}

/**
 * Cache data in localStorage with TTL
 */
export class LocalCache {
    static set<T>(key: string, data: T, ttlMinutes: number = 60): void {
        try {
            const item: CacheItem<T> = {
                data,
                timestamp: Date.now(),
                ttl: ttlMinutes * 60 * 1000
            };
            localStorage.setItem(key, JSON.stringify(item));
        } catch (error) {
            console.error('Error saving to cache:', error);
        }
    }

    static get<T>(key: string): T | null {
        try {
            const itemStr = localStorage.getItem(key);
            if (!itemStr) return null;

            const item: CacheItem<T> = JSON.parse(itemStr);
            const now = Date.now();

            // Check if expired
            if (now - item.timestamp > item.ttl) {
                localStorage.removeItem(key);
                return null;
            }

            return item.data;
        } catch (error) {
            console.error('Error reading from cache:', error);
            return null;
        }
    }

    static clear(key?: string): void {
        if (key) {
            localStorage.removeItem(key);
        } else {
            localStorage.clear();
        }
    }
}

// ===================================
// 4. REQUEST BATCHING
// ===================================

/**
 * Batch multiple requests together
 */
export class RequestBatcher<T, R> {
    private queue: Array<{ item: T; resolve: (value: R) => void; reject: (reason: any) => void }> = [];
    private batchTimeout: ReturnType<typeof setTimeout> | null = null;
    private batchHandler: (items: T[]) => Promise<R[]>;
    private maxBatchSize: number;
    private batchDelay: number;

    constructor(
        batchHandler: (items: T[]) => Promise<R[]>,
        maxBatchSize: number = 10,
        batchDelay: number = 50
    ) {
        this.batchHandler = batchHandler;
        this.maxBatchSize = maxBatchSize;
        this.batchDelay = batchDelay;
    }

    add(item: T): Promise<R> {
        return new Promise((resolve, reject) => {
            this.queue.push({ item, resolve, reject });

            if (this.queue.length >= this.maxBatchSize) {
                this.flush();
            } else if (!this.batchTimeout) {
                this.batchTimeout = setTimeout(() => this.flush(), this.batchDelay);
            }
        });
    }

    private async flush(): Promise<void> {
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }

        if (this.queue.length === 0) return;

        const batch = this.queue.splice(0, this.queue.length);
        const items = batch.map(b => b.item);

        try {
            const results = await this.batchHandler(items);
            batch.forEach((b, index) => b.resolve(results[index]));
        } catch (error) {
            batch.forEach(b => b.reject(error));
        }
    }
}

// ===================================
// 5. PERFORMANCE MONITORING
// ===================================

/**
 * Measure and log performance metrics
 */
export class PerformanceMonitor {
    private marks: Map<string, number> = new Map();

    start(label: string): void {
        this.marks.set(label, performance.now());
    }

    end(label: string, log: boolean = true): number {
        const startTime = this.marks.get(label);
        if (!startTime) {
            console.warn(`No start mark found for: ${label}`);
            return 0;
        }

        const duration = performance.now() - startTime;
        this.marks.delete(label);

        if (log) {
            console.log(`⏱️ ${label}: ${duration.toFixed(2)}ms`);
        }

        return duration;
    }

    measure(label: string, fn: () => any): any {
        this.start(label);
        const result = fn();
        this.end(label);
        return result;
    }

    async measureAsync(label: string, fn: () => Promise<any>): Promise<any> {
        this.start(label);
        try {
            const result = await fn();
            this.end(label);
            return result;
        } catch (error) {
            this.end(label);
            throw error;
        }
    }
}

export const perfMonitor = new PerformanceMonitor();

// ===================================
// 6. MEMORY MANAGEMENT
// ===================================

/**
 * Dispose of Three.js objects properly
 */
export function disposeThreeObject(object: any): void {
    if (!object) return;

    if (object.geometry) {
        object.geometry.dispose();
    }

    if (object.material) {
        if (Array.isArray(object.material)) {
            object.material.forEach((material: any) => {
                disposeMaterial(material);
            });
        } else {
            disposeMaterial(object.material);
        }
    }

    if (object.texture) {
        object.texture.dispose();
    }

    if (object.children) {
        object.children.forEach((child: any) => disposeThreeObject(child));
    }
}

function disposeMaterial(material: any): void {
    if (!material) return;

    const textures = [
        'map',
        'lightMap',
        'bumpMap',
        'normalMap',
        'specularMap',
        'envMap',
        'alphaMap',
        'aoMap',
        'displacementMap',
        'emissiveMap',
        'gradientMap',
        'metalnessMap',
        'roughnessMap'
    ];

    textures.forEach(key => {
        if (material[key]) {
            material[key].dispose();
        }
    });

    material.dispose();
}

// ===================================
// 7. RESOURCE POOL
// ===================================

/**
 * Object pool for reusing objects instead of creating new ones
 */
export class ObjectPool<T> {
    private available: T[] = [];
    private factory: () => T;
    private reset: (obj: T) => void;

    constructor(factory: () => T, reset: (obj: T) => void, initialSize: number = 10) {
        this.factory = factory;
        this.reset = reset;

        for (let i = 0; i < initialSize; i++) {
            this.available.push(factory());
        }
    }

    acquire(): T {
        if (this.available.length > 0) {
            return this.available.pop()!;
        }
        return this.factory();
    }

    release(obj: T): void {
        this.reset(obj);
        this.available.push(obj);
    }

    clear(): void {
        this.available = [];
    }
}

// ===================================
// 8. COMPRESSION UTILITIES
// ===================================

/**
 * Compress data before storing
 */
export function compressJSON(data: any): string {
    const jsonString = JSON.stringify(data);
    // Simple run-length encoding for repeated patterns
    return jsonString.replace(/(.)\1{3,}/g, (match, char) => {
        return `${char}*${match.length}`;
    });
}

export function decompressJSON(compressed: string): any {
    const jsonString = compressed.replace(/(.)\*(\d+)/g, (match, char, count) => {
        return char.repeat(parseInt(count));
    });
    return JSON.parse(jsonString);
}

// ===================================
// 9. WEBWORKER UTILITIES
// ===================================

/**
 * Run heavy computations in Web Workers
 */
export function runInWorker<T, R>(fn: (data: T) => R, data: T): Promise<R> {
    return new Promise((resolve, reject) => {
        const blob = new Blob(
            [`self.onmessage = function(e) { 
                const result = (${fn.toString()})(e.data); 
                self.postMessage(result); 
            }`],
            { type: 'application/javascript' }
        );
        const workerUrl = URL.createObjectURL(blob);
        const worker = new Worker(workerUrl);

        worker.onmessage = (e) => {
            resolve(e.data);
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
        };

        worker.onerror = (error) => {
            reject(error);
            worker.terminate();
            URL.revokeObjectURL(workerUrl);
        };

        worker.postMessage(data);
    });
}

// ===================================
// 10. ANIMATION OPTIMIZATION
// ===================================

/**
 * Request animation frame with automatic cleanup
 */
export class AnimationManager {
    private animations: Map<string, number> = new Map();

    start(id: string, callback: (timestamp: number) => void): void {
        this.stop(id); // Stop existing animation with same ID

        const animate = (timestamp: number) => {
            callback(timestamp);
            const rafId = requestAnimationFrame(animate);
            this.animations.set(id, rafId);
        };

        const rafId = requestAnimationFrame(animate);
        this.animations.set(id, rafId);
    }

    stop(id: string): void {
        const rafId = this.animations.get(id);
        if (rafId !== undefined) {
            cancelAnimationFrame(rafId);
            this.animations.delete(id);
        }
    }

    stopAll(): void {
        this.animations.forEach((rafId) => cancelAnimationFrame(rafId));
        this.animations.clear();
    }
}

export const animationManager = new AnimationManager();

// ===================================
// 11. NETWORK OPTIMIZATION
// ===================================

/**
 * Retry failed requests with exponential backoff
 */
export async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error as Error;
            if (attempt < maxRetries - 1) {
                const delay = initialDelay * Math.pow(2, attempt);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError!;
}

/**
 * Check if user is online
 */
export function isOnline(): boolean {
    return navigator.onLine;
}

/**
 * Wait for online connection
 */
export function waitForOnline(): Promise<void> {
    if (isOnline()) return Promise.resolve();

    return new Promise((resolve) => {
        const handleOnline = () => {
            window.removeEventListener('online', handleOnline);
            resolve();
        };
        window.addEventListener('online', handleOnline);
    });
}
