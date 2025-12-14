import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
// УДАЛЕНО: import db from '$lib/db';
import { hashPassword, generateToken } from '$lib/auth';
import { sanitizeInput } from '$lib/utils';

export const POST: RequestHandler = async (event) => {
    // ⭐ НОВОЕ: Получаем D1 Binding из event.platform.env ⭐
    const db = event.platform?.env.DB;

    if (!db) {
        return json({ error: 'Database connection failed' }, { status: 500 });
    }
    
    try {
        const { username, email, password } = await event.request.json();

        if (!username || !email || !password) {
            return json({ error: 'All fields are required' }, { status: 400 });
        }

        // Sanitize user input to prevent XSS
        const sanitizedUsername = sanitizeInput(username, 50);
        const sanitizedEmail = sanitizeInput(email, 100);

        if (!sanitizedUsername.trim()) {
            return json({ error: 'Username cannot be empty' }, { status: 400 });
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(sanitizedEmail)) {
            return json({ error: 'Invalid email format' }, { status: 400 });
        }

        if (password.length < 6) {
            return json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        // ⭐ D1: Проверка существующего пользователя (асинхронно: .bind().first()) ⭐
        const existingUser = await db.prepare('SELECT id FROM users WHERE email = ? OR username = ?')
                                     .bind(sanitizedEmail, sanitizedUsername)
                                     .first();

        if (existingUser) {
            return json({ error: 'User already exists' }, { status: 409 });
        }

        const hashedPassword = hashPassword(password);
        const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(sanitizedUsername)}&background=9b59b6&color=fff`;

        // ⭐ D1: Вставка нового пользователя (асинхронно: .bind().run()) ⭐
        const result = await db.prepare(`
            INSERT INTO users (username, email, password, avatar)
            VALUES (?, ?, ?, ?)
        `).bind(sanitizedUsername, sanitizedEmail, hashedPassword, avatarUrl).run();

        // D1 возвращает last_row_id в result.meta
        const user = {
            id: result.meta.last_row_id as number,
            username: sanitizedUsername,
            email: sanitizedEmail,
            avatar: avatarUrl
        };

        const token = generateToken(user);

        return json(
            { user, token },
            {
                status: 201,
                headers: {
                    'Set-Cookie': `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
                }
            }
        );
    } catch (error) {
        console.error('Register error:', error);
        return json({ error: 'Registration failed' }, { status: 500 });
    }
};