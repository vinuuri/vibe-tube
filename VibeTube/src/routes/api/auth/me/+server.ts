import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserFromRequest } from '$lib/auth';
// УДАЛЕНО: import db from '$lib/db';

export const GET: RequestHandler = async (event) => {
    // ⭐ НОВОЕ: Получаем D1 Binding из event.platform.env ⭐
    const db = event.platform?.env.DB;

    if (!db) {
        return json({ error: 'Database connection failed' }, { status: 500 });
    }

    const user = getUserFromRequest(event);

    if (!user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    // ⭐ D1: Получаем полные данные пользователя (асинхронно: .bind().first()) ⭐
    const fullUser = await db.prepare(`
        SELECT id, username, email, avatar, banner, description, created_at
        FROM users WHERE id = ?
    `).bind(user.id).first();

    if (!fullUser) {
        return json({ error: 'User not found' }, { status: 404 });
    }

    return json({ user: fullUser });
};
