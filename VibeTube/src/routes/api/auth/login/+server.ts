import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
// УДАЛЕНО: import db from '$lib/db';
import { verifyPassword, generateToken } from '$lib/auth';

export const POST: RequestHandler = async (event) => {
    // ⭐ НОВОЕ: Получаем D1 Binding из event.platform.env ⭐
    const db = event.platform?.env.DB;

    if (!db) {
        return json({ error: 'Database connection failed' }, { status: 500 });
    }

    try {
        const { email, password } = await event.request.json();

        if (!email || !password) {
            return json({ error: 'Email and password are required' }, { status: 400 });
        }

        // ⭐ D1: Получаем пользователя по email (асинхронно: .bind().first()) ⭐
        const user = await db.prepare('SELECT * FROM users WHERE email = ?')
                             .bind(email)
                             .first();

        if (!user || !verifyPassword(password, user.password)) {
            return json({ error: 'Invalid credentials' }, { status: 401 });
        }

        // Убедитесь, что user.password удален перед созданием токена!
        delete user.password;
        
        const userPayload = {
            id: user.id,
            username: user.username,
            email: user.email
            // Мы не можем использовать user целиком, так как D1 возвращает все поля.
            // Используем userPayload для ясности.
        };

        const token = generateToken(userPayload);

        return json(
            { user: userPayload, token },
            {
                status: 200,
                headers: {
                    'Set-Cookie': `token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
                }
            }
        );
    } catch (error) {
        console.error('Login error:', error);
        return json({ error: 'Login failed' }, { status: 500 });
    }
};