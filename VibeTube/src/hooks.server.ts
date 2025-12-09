import type { Handle } from '@sveltejs/kit';
import { generateCsrfToken, validateCsrfMiddleware } from '$lib/auth';
import { parse } from 'cookie';

export const handle: Handle = async ({ event, resolve }) => {
	// Generate CSRF token if not present
	const cookieHeader = event.request.headers.get('cookie');
	const cookies = cookieHeader ? parse(cookieHeader) : {};
	
	if (!cookies.csrf_token) {
		const csrfToken = generateCsrfToken();
		event.cookies.set('csrf_token', csrfToken, {
			path: '/',
			httpOnly: false, // Need to access from JavaScript
			sameSite: 'lax',
			secure: process.env.NODE_ENV === 'production',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});
	}

	// Validate CSRF for state-changing operations
	const csrfValidation = validateCsrfMiddleware(event);
	if (!csrfValidation.valid) {
		return new Response(JSON.stringify({ error: csrfValidation.error || 'CSRF validation failed' }), {
			status: 403,
			headers: { 'Content-Type': 'application/json' }
		});
	}

	return resolve(event);
};

