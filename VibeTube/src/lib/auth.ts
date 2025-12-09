import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import type { RequestEvent } from '@sveltejs/kit';
import { parse } from 'cookie';

const JWT_SECRET = process.env.JWT_SECRET || 'vibetube-secret-key-change-in-production';
const CSRF_SECRET = process.env.CSRF_SECRET || 'vibetube-csrf-secret-change-in-production';

export interface UserPayload {
	id: number;
	username: string;
	email: string;
}

export function hashPassword(password: string): string {
	return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
	return bcrypt.compareSync(password, hash);
}

export function generateToken(user: UserPayload): string {
	return jwt.sign(user, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): UserPayload | null {
	try {
		return jwt.verify(token, JWT_SECRET) as UserPayload;
	} catch {
		return null;
	}
}

export function getUserFromRequest(event: RequestEvent): UserPayload | null {
	const cookieHeader = event.request.headers.get('cookie');
	if (!cookieHeader) return null;

	const cookies = parse(cookieHeader);
	const token = cookies.token;

	if (!token) return null;

	return verifyToken(token);
}

/**
 * CSRF Protection Utilities
 */
export function generateCsrfToken(): string {
	return crypto.randomBytes(32).toString('hex');
}

export function getCsrfTokenFromRequest(event: RequestEvent): string | null {
	// Try to get from header first (preferred for API requests)
	const headerToken = event.request.headers.get('x-csrf-token');
	if (headerToken) return headerToken;

	// Try to get from cookie
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

	// Compare tokens securely (must be same length)
	if (providedToken.length !== sessionToken.length) return false;

	try {
		return crypto.timingSafeEqual(
			Buffer.from(providedToken, 'utf8'),
			Buffer.from(sessionToken, 'utf8')
		);
	} catch {
		return false;
	}
}

/**
 * Validate CSRF token (can be used in individual handlers)
 */
export async function validateCsrfForRequest(event: RequestEvent): Promise<{ valid: boolean; error?: string }> {
	const method = event.request.method;

	// Only check CSRF for state-changing methods
	if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
		return { valid: true };
	}

	// Skip CSRF check for certain endpoints (like login/register with their own validation)
	const url = event.url.pathname;
	const skipCsrfPaths = ['/api/auth/login', '/api/auth/register'];
	if (skipCsrfPaths.some(path => url.startsWith(path))) {
		return { valid: true };
	}

	// Try header first
	let token = getCsrfTokenFromRequest(event);
	
	// If not in header, try body (for JSON requests)
	if (!token) {
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

/**
 * Middleware to validate CSRF token for state-changing operations
 */
export function validateCsrfMiddleware(event: RequestEvent): { valid: boolean; error?: string } {
	const method = event.request.method;

	// Only check CSRF for state-changing methods
	if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
		return { valid: true };
	}

	// Skip CSRF check for certain endpoints
	const url = event.url.pathname;
	const skipCsrfPaths = ['/api/auth/login', '/api/auth/register'];
	if (skipCsrfPaths.some(path => url.startsWith(path))) {
		return { valid: true };
	}

	// For non-JSON requests, check immediately
	const contentType = event.request.headers.get('content-type') || '';
	if (!contentType.includes('application/json')) {
		const token = getCsrfTokenFromRequest(event);
		if (!token || !validateCsrfToken(event, token)) {
			return { valid: false, error: 'Invalid CSRF token' };
		}
	}

	// For JSON requests, we'll validate in individual handlers
	return { valid: true };
}
