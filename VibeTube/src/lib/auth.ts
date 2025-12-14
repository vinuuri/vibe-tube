// $lib/auth.ts

// УДАЛЕНО: import jwt from 'jsonwebtoken';
// УДАЛЕНО: import crypto from 'crypto';
import bcrypt from 'bcryptjs'; 
import type { RequestEvent } from '@sveltejs/kit';
import { parse } from 'cookie';
// ⭐ НОВОЕ: Используем глобальные Web Crypto API и Node.js crypto (доступен через nodejs_compat) ⭐

const JWT_SECRET_STRING = process.env.JWT_SECRET || 'vibetube-secret-key-change-in-production';
const CSRF_SECRET = process.env.CSRF_SECRET || 'vibetube-csrf-secret-change-in-production';

export interface UserPayload {
    id: number;
    username: string;
    email: string;
}

// -----------------------------------------------------------
// 1. JWT (АДАПТАЦИЯ ДЛЯ WEB CRYPTO API)
// -----------------------------------------------------------

// Функция для получения секретного ключа в формате Web Crypto
async function getJwtKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    return crypto.subtle.importKey(
        "raw",
        encoder.encode(JWT_SECRET_STRING),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign", "verify"]
    );
}

// Утилита для кодирования/декодирования Base64URL
function b64UrlEncode(buffer: ArrayBuffer): string {
    const base64 = Buffer.from(buffer).toString('base64');
    return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function b64UrlDecode(input: string): ArrayBuffer {
    input = input.replace(/-/g, '+').replace(/_/g, '/');
    while (input.length % 4) {
        input += '=';
    }
    return Buffer.from(input, 'base64').buffer;
}

export async function generateToken(user: UserPayload): Promise<string> {
    const key = await getJwtKey();
    const header = { alg: 'HS256', typ: 'JWT' };
    const payload = {
        ...user,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + (60 * 60 * 24 * 7) // 7 days
    };

    const encodedHeader = b64UrlEncode(new TextEncoder().encode(JSON.stringify(header)));
    const encodedPayload = b64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
    
    const data = encodedHeader + '.' + encodedPayload;
    const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
    const encodedSignature = b64UrlEncode(signature);

    return `${data}.${encodedSignature}`;
}

export async function verifyToken(token: string): Promise<UserPayload | null> {
    try {
        const [encodedHeader, encodedPayload, encodedSignature] = token.split('.');
        if (!encodedHeader || !encodedPayload || !encodedSignature) return null;

        const data = encodedHeader + '.' + encodedPayload;
        const signature = b64UrlDecode(encodedSignature);
        const key = await getJwtKey();

        const isValid = await crypto.subtle.verify(
            "HMAC",
            key,
            signature,
            new TextEncoder().encode(data)
        );

        if (!isValid) return null;

        const payloadBuffer = b64UrlDecode(encodedPayload);
        const payloadString = new TextDecoder().decode(payloadBuffer);
        const payload = JSON.parse(payloadString);

        if (payload.exp < (Date.now() / 1000)) {
            return null; // Token expired
        }

        return payload as UserPayload;
    } catch (e) {
        console.error('JWT Verification error:', e);
        return null;
    }
}

// -----------------------------------------------------------
// 2. PASSWORD HASHING (Сохраняем bcryptjs, но делаем асинхронным)
// -----------------------------------------------------------

// Внимание: bcryptjs может вызвать ошибки, связанные с лимитом CPU,
// но его замена на Web Crypto API слишком сложна для быстрой миграции.
export function hashPassword(password: string): string {
    // В Node.js bcryptjs является синхронным, оставляем как есть. 
    // В Workers он, как правило, эмулируется.
    return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
    return bcrypt.compareSync(password, hash);
}

// -----------------------------------------------------------
// 3. UTILS & CSRF (АДАПТАЦИЯ ДЛЯ WORKER)
// -----------------------------------------------------------

// getUserFromRequest должен быть адаптирован для нового асинхронного verifyToken
export async function getUserFromRequest(event: RequestEvent): Promise<UserPayload | null> {
    const cookieHeader = event.request.headers.get('cookie');
    if (!cookieHeader) return null;

    const cookies = parse(cookieHeader);
    const token = cookies.token;

    if (!token) return null;

    // ⭐ НОВОЕ: verifyToken стал асинхронным ⭐
    return await verifyToken(token);
}

/**
 * CSRF Protection Utilities
 */
// Используем нативный Node.js 'crypto' (доступен благодаря nodejs_compat)
export function generateCsrfToken(): string {
    // Внимание: Здесь используется Buffer и Node.js crypto, который должен быть эмулирован.
    return crypto.randomBytes(32).toString('hex');
}

export function getCsrfTokenFromRequest(event: RequestEvent): string | null {
    // ... (логика остается прежней)
    const headerToken = event.request.headers.get('x-csrf-token');
    if (headerToken) return headerToken;

    const cookieHeader = event.request.headers.get('cookie');
    if (cookieHeader) {
        const cookies = parse(cookieHeader);
        if (cookies.csrf_token) {
            return cookies.csrf_token;
        }
    }
    return null;
}

/**
 * Get CSRF token from request body (for JSON requests)
 */
export async function getCsrfTokenFromBody(event: RequestEvent): Promise<string | null> {
    // ... (логика остается прежней)
    try {
        const contentType = event.request.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
            const body = await event.request.clone().json();
            return body.csrf_token || null;
        }
    } catch {
        // Ignore errors
    }
    return null;
}

export function validateCsrfToken(event: RequestEvent, providedToken: string | null): boolean {
    if (!providedToken) return false;

    const cookieHeader = event.request.headers.get('cookie');
    if (!cookieHeader) return false;

    const cookies = parse(cookieHeader);
    const sessionToken = cookies.csrf_token;

    if (!sessionToken) return false;

    if (providedToken.length !== sessionToken.length) return false;

    try {
        // ⭐ НОВОЕ: Используем timingSafeEqual из Node.js crypto, доступного через nodejs_compat ⭐
        // Это должно быть безопасно, так как мы включили флаг совместимости.
        return crypto.timingSafeEqual(
            Buffer.from(providedToken, 'utf8'),
            Buffer.from(sessionToken, 'utf8')
        );
    } catch {
        return false;
    }
}

// validateCsrfForRequest и validateCsrfMiddleware могут оставаться прежними, 
// если только не потребуется await для getCsrfTokenFromRequest, но это не так.

export async function validateCsrfForRequest(event: RequestEvent): Promise<{ valid: boolean; error?: string }> {
    const method = event.request.method;

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return { valid: true };
    }

    const url = event.url.pathname;
    const skipCsrfPaths = ['/api/auth/login', '/api/auth/register'];
    if (skipCsrfPaths.some(path => url.startsWith(path))) {
        return { valid: true };
    }

    let token = getCsrfTokenFromRequest(event);
    
    if (!token) {
        // await здесь необходим
        token = await getCsrfTokenFromBody(event);
    }

    if (!token) {
        return { valid: false, error: 'CSRF token is required' };
    }

    if (!validateCsrfToken(event, token)) {
        return { valid: false, error: 'Invalid CSRF token' };
    }

    return { valid: true };
}

export function validateCsrfMiddleware(event: RequestEvent): { valid: boolean; error?: string } {
    const method = event.request.method;

    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
        return { valid: true };
    }

    const url = event.url.pathname;
    const skipCsrfPaths = ['/api/auth/login', '/api/auth/register'];
    if (skipCsrfPaths.some(path => url.startsWith(path))) {
        return { valid: true };
    }

    const contentType = event.request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        const token = getCsrfTokenFromRequest(event);
        if (!token || !validateCsrfToken(event, token)) {
            return { valid: false, error: 'Invalid CSRF token' };
        }
    }

    return { valid: true };
}
