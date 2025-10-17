/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Error Handling & User Notifications System
 */

// ===================================
// 1. ERROR TYPES
// ===================================

export enum ErrorType {
    NETWORK = 'network',
    AUTH = 'auth',
    DATABASE = 'database',
    VALIDATION = 'validation',
    AI_API = 'ai_api',
    STORAGE = 'storage',
    UNKNOWN = 'unknown'
}

export interface AppError {
    type: ErrorType;
    message: string;
    userMessage: string;
    originalError?: any;
    timestamp: Date;
    context?: any;
}

// ===================================
// 2. ERROR PARSER
// ===================================

export class ErrorHandler {
    /**
     * Parse and categorize errors
     */
    static parse(error: any, context?: any): AppError {
        const timestamp = new Date();

        // Firebase Authentication Errors
        if (error?.code?.startsWith('auth/')) {
            return {
                type: ErrorType.AUTH,
                message: error.code,
                userMessage: this.getAuthErrorMessage(error.code),
                originalError: error,
                timestamp,
                context
            };
        }

        // Firebase Firestore Errors
        if (error?.code?.includes('firestore') || error?.code?.startsWith('permission')) {
            return {
                type: ErrorType.DATABASE,
                message: error.message || 'Database error',
                userMessage: 'Unable to save or retrieve data. Please try again.',
                originalError: error,
                timestamp,
                context
            };
        }

        // Network Errors
        if (error?.message?.includes('network') || error?.message?.includes('fetch') || !navigator.onLine) {
            return {
                type: ErrorType.NETWORK,
                message: error.message || 'Network error',
                userMessage: 'No internet connection. Please check your network and try again.',
                originalError: error,
                timestamp,
                context
            };
        }

        // AI API Errors
        if (error?.message?.includes('API') || error?.message?.includes('Gemini')) {
            return {
                type: ErrorType.AI_API,
                message: error.message || 'AI API error',
                userMessage: 'AI service is temporarily unavailable. Please try again in a moment.',
                originalError: error,
                timestamp,
                context
            };
        }

        // Storage Errors
        if (error?.code?.includes('storage')) {
            return {
                type: ErrorType.STORAGE,
                message: error.message || 'Storage error',
                userMessage: 'Unable to upload file. Please check file size and format.',
                originalError: error,
                timestamp,
                context
            };
        }

        // Validation Errors
        if (error?.name === 'ValidationError') {
            return {
                type: ErrorType.VALIDATION,
                message: error.message,
                userMessage: error.message,
                originalError: error,
                timestamp,
                context
            };
        }

        // Generic Error
        return {
            type: ErrorType.UNKNOWN,
            message: error?.message || String(error),
            userMessage: 'Something went wrong. Please try again.',
            originalError: error,
            timestamp,
            context
        };
    }

    /**
     * Get user-friendly auth error messages
     */
    private static getAuthErrorMessage(code: string): string {
        const messages: Record<string, string> = {
            'auth/email-already-in-use': 'This email is already registered. Please sign in instead.',
            'auth/invalid-email': 'Please enter a valid email address.',
            'auth/operation-not-allowed': 'This sign-in method is not enabled.',
            'auth/weak-password': 'Password should be at least 6 characters long.',
            'auth/user-disabled': 'This account has been disabled.',
            'auth/user-not-found': 'No account found with this email.',
            'auth/wrong-password': 'Incorrect password. Please try again.',
            'auth/invalid-credential': 'Invalid email or password.',
            'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
            'auth/network-request-failed': 'Network error. Please check your connection.',
            'auth/popup-closed-by-user': 'Sign-in cancelled.',
            'auth/cancelled-popup-request': 'Sign-in cancelled.',
            'auth/popup-blocked': 'Pop-up blocked. Please allow pop-ups for this site.'
        };

        return messages[code] || 'Authentication error. Please try again.';
    }

    /**
     * Log error for debugging
     */
    static log(error: AppError): void {
        console.error(`[${error.type.toUpperCase()}] ${error.message}`, {
            userMessage: error.userMessage,
            timestamp: error.timestamp,
            context: error.context,
            original: error.originalError
        });

        // Send to analytics in production
        if (typeof window !== 'undefined' && (window as any).gtag) {
            (window as any).gtag('event', 'exception', {
                description: error.message,
                fatal: false
            });
        }
    }
}

// ===================================
// 3. TOAST NOTIFICATIONS
// ===================================

export enum NotificationType {
    SUCCESS = 'success',
    ERROR = 'error',
    WARNING = 'warning',
    INFO = 'info'
}

export interface Notification {
    id: string;
    type: NotificationType;
    message: string;
    duration?: number;
    action?: {
        label: string;
        callback: () => void;
    };
}

export class NotificationManager {
    private container: HTMLElement | null = null;
    private notifications: Map<string, HTMLElement> = new Map();

    constructor() {
        this.createContainer();
    }

    private createContainer(): void {
        if (typeof document === 'undefined') return;

        this.container = document.createElement('div');
        this.container.id = 'notification-container';
        this.container.className = 'notification-container';
        document.body.appendChild(this.container);

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .notification-container {
                position: fixed;
                top: 20px;
                right: 20px;
                z-index: 10000;
                display: flex;
                flex-direction: column;
                gap: 12px;
                max-width: 400px;
                pointer-events: none;
            }

            .notification {
                background: var(--card-bg-color);
                border: 1px solid var(--border-color);
                border-radius: 12px;
                padding: 16px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                display: flex;
                align-items: flex-start;
                gap: 12px;
                animation: slideIn 0.3s ease-out;
                pointer-events: all;
                min-width: 320px;
            }

            .notification.removing {
                animation: slideOut 0.3s ease-out forwards;
            }

            @keyframes slideIn {
                from {
                    transform: translateX(calc(100% + 20px));
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }

            @keyframes slideOut {
                to {
                    transform: translateX(calc(100% + 20px));
                    opacity: 0;
                }
            }

            .notification-icon {
                flex-shrink: 0;
                width: 24px;
                height: 24px;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 16px;
            }

            .notification.success .notification-icon {
                background: var(--positive-change);
                color: white;
            }

            .notification.error .notification-icon {
                background: var(--error-color);
                color: white;
            }

            .notification.warning .notification-icon {
                background: #f59e0b;
                color: white;
            }

            .notification.info .notification-icon {
                background: var(--primary-accent);
                color: white;
            }

            .notification-content {
                flex: 1;
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .notification-message {
                color: var(--text-color);
                font-size: 14px;
                line-height: 1.5;
            }

            .notification-action {
                display: flex;
                gap: 8px;
            }

            .notification-btn {
                padding: 6px 12px;
                border: none;
                border-radius: 6px;
                font-size: 12px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }

            .notification-btn-primary {
                background: var(--primary-accent);
                color: white;
            }

            .notification-btn-primary:hover {
                background: var(--primary-accent-dark);
            }

            .notification-btn-dismiss {
                background: transparent;
                color: var(--text-color-secondary);
            }

            .notification-btn-dismiss:hover {
                background: var(--bg-color);
            }

            .notification-close {
                position: absolute;
                top: 12px;
                right: 12px;
                width: 20px;
                height: 20px;
                border: none;
                background: transparent;
                color: var(--text-color-secondary);
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                border-radius: 4px;
                transition: background-color 0.2s;
            }

            .notification-close:hover {
                background: var(--bg-color);
            }
        `;
        document.head.appendChild(style);
    }

    show(notification: Omit<Notification, 'id'>): string {
        if (!this.container) this.createContainer();

        const id = `notification-${Date.now()}-${Math.random()}`;
        const element = this.createElement({ ...notification, id });

        this.container?.appendChild(element);
        this.notifications.set(id, element);

        // Auto dismiss
        const duration = notification.duration ?? 5000;
        if (duration > 0) {
            setTimeout(() => this.dismiss(id), duration);
        }

        return id;
    }

    success(message: string, duration?: number): string {
        return this.show({ type: NotificationType.SUCCESS, message, duration });
    }

    error(message: string, duration?: number): string {
        return this.show({ type: NotificationType.ERROR, message, duration: duration ?? 7000 });
    }

    warning(message: string, duration?: number): string {
        return this.show({ type: NotificationType.WARNING, message, duration });
    }

    info(message: string, duration?: number): string {
        return this.show({ type: NotificationType.INFO, message, duration });
    }

    dismiss(id: string): void {
        const element = this.notifications.get(id);
        if (!element) return;

        element.classList.add('removing');
        setTimeout(() => {
            element.remove();
            this.notifications.delete(id);
        }, 300);
    }

    dismissAll(): void {
        this.notifications.forEach((_, id) => this.dismiss(id));
    }

    private createElement(notification: Notification): HTMLElement {
        const div = document.createElement('div');
        div.className = `notification ${notification.type}`;
        div.setAttribute('role', 'alert');

        const icons = {
            success: '✓',
            error: '✕',
            warning: '!',
            info: 'i'
        };

        div.innerHTML = `
            <div class="notification-icon">${icons[notification.type]}</div>
            <div class="notification-content">
                <div class="notification-message">${notification.message}</div>
                ${notification.action ? `
                    <div class="notification-action">
                        <button class="notification-btn notification-btn-primary" data-action="primary">
                            ${notification.action.label}
                        </button>
                        <button class="notification-btn notification-btn-dismiss" data-action="dismiss">
                            Dismiss
                        </button>
                    </div>
                ` : ''}
            </div>
            <button class="notification-close" aria-label="Close">×</button>
        `;

        // Event listeners
        div.querySelector('.notification-close')?.addEventListener('click', () => {
            this.dismiss(notification.id);
        });

        div.querySelector('[data-action="dismiss"]')?.addEventListener('click', () => {
            this.dismiss(notification.id);
        });

        div.querySelector('[data-action="primary"]')?.addEventListener('click', () => {
            notification.action?.callback();
            this.dismiss(notification.id);
        });

        return div;
    }
}

// Singleton instance
export const notify = new NotificationManager();

// ===================================
// 4. LOADING INDICATORS
// ===================================

export class LoadingManager {
    private activeLoaders: Set<string> = new Set();
    private overlay: HTMLElement | null = null;

    showGlobal(message: string = 'Loading...'): string {
        const id = `loader-${Date.now()}`;
        this.activeLoaders.add(id);

        if (!this.overlay) {
            this.overlay = document.createElement('div');
            this.overlay.className = 'global-loader-overlay';
            this.overlay.innerHTML = `
                <div class="global-loader">
                    <div class="spinner"></div>
                    <p class="loader-message">${message}</p>
                </div>
            `;
            document.body.appendChild(this.overlay);

            // Add styles if not exists
            if (!document.getElementById('loader-styles')) {
                const style = document.createElement('style');
                style.id = 'loader-styles';
                style.textContent = `
                    .global-loader-overlay {
                        position: fixed;
                        top: 0;
                        left: 0;
                        right: 0;
                        bottom: 0;
                        background: rgba(0, 0, 0, 0.5);
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        z-index: 9999;
                        backdrop-filter: blur(4px);
                    }

                    .global-loader {
                        background: var(--card-bg-color);
                        border-radius: 16px;
                        padding: 32px;
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 16px;
                        box-shadow: 0 8px 32px rgba(0,0,0,0.3);
                    }

                    .global-loader .spinner {
                        width: 48px;
                        height: 48px;
                        border: 4px solid var(--border-color);
                        border-top-color: var(--primary-accent);
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                    }

                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }

                    .loader-message {
                        color: var(--text-color);
                        font-size: 14px;
                        margin: 0;
                    }
                `;
                document.head.appendChild(style);
            }
        }

        return id;
    }

    hideGlobal(id: string): void {
        this.activeLoaders.delete(id);

        if (this.activeLoaders.size === 0 && this.overlay) {
            this.overlay.remove();
            this.overlay = null;
        }
    }
}

export const loader = new LoadingManager();

// ===================================
// 5. FORM VALIDATION
// ===================================

export interface ValidationRule {
    validate: (value: any) => boolean;
    message: string;
}

export class FormValidator {
    static email(value: string): { valid: boolean; message?: string } {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(value)
            ? { valid: true }
            : { valid: false, message: 'Please enter a valid email address' };
    }

    static password(value: string, minLength: number = 6): { valid: boolean; message?: string } {
        if (value.length < minLength) {
            return { valid: false, message: `Password must be at least ${minLength} characters long` };
        }
        return { valid: true };
    }

    static required(value: any): { valid: boolean; message?: string } {
        const valid = value !== null && value !== undefined && value !== '';
        return valid
            ? { valid: true }
            : { valid: false, message: 'This field is required' };
    }

    static custom(value: any, rules: ValidationRule[]): { valid: boolean; message?: string } {
        for (const rule of rules) {
            if (!rule.validate(value)) {
                return { valid: false, message: rule.message };
            }
        }
        return { valid: true };
    }
}
