// src/hooks.server.ts

import type { Handle } from '@sveltejs/kit';
import { generateCsrfToken, validateCsrfMiddleware } from '$lib/auth';
import { parse } from 'cookie';
// ⭐ НОВОЕ: Импортируем функцию инициализации схемы D1 ⭐
import { initDatabase } from '$lib/db'; 
// Предполагаем, что ваш обновленный файл с экспортом схемы называется $lib/db.ts
// Если вы переименовали его, измените путь здесь.

// Флаг, чтобы избежать повторной инициализации схемы
let databaseInitialized = false;

export const handle: Handle = async ({ event, resolve }) => {

    // ⭐ НОВОЕ: Асинхронная инициализация схемы D1 ⭐
    // Это запускается только один раз на Worker (при первом запросе).
    if (!databaseInitialized && event.platform?.env.DB) {
        try {
            await initDatabase(event.platform.env.DB);
            databaseInitialized = true;
        } catch (e) {
            console.error("Failed to initialize database schema:", e);
            // Можно разрешить запрос, но API, требующие БД, завершатся ошибкой 500.
        }
    }
    
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
