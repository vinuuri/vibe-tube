/**
 * Client-side CSRF token utilities
 */

/**
 * Get CSRF token from cookie
 */
export function getCsrfToken(): string | null {
	if (typeof document === 'undefined') return null;
	
	const cookies = document.cookie.split(';');
	for (const cookie of cookies) {
		const [name, value] = cookie.trim().split('=');
		if (name === 'csrf_token') {
			return value;
		}
	}
	return null;
}

/**
 * Helper function to add CSRF token to fetch requests
 */
export function addCsrfToken(headers: HeadersInit = {}, body?: any): { headers: HeadersInit; body?: any } {
	const token = getCsrfToken();
	
	const headersObj = headers instanceof Headers 
		? Object.fromEntries(headers.entries())
		: Array.isArray(headers)
		? Object.fromEntries(headers as [string, string][])
		: headers || {};

	// Add CSRF token to headers
	if (token) {
		headersObj['X-CSRF-Token'] = token;
	}

	// For JSON requests, also add to body
	if (body && typeof body === 'object' && !(body instanceof FormData)) {
		const bodyObj = typeof body === 'string' ? JSON.parse(body) : body;
		bodyObj.csrf_token = token;
		return {
			headers: headersObj,
			body: JSON.stringify(bodyObj)
		};
	}

	return { headers: headersObj, body };
}

