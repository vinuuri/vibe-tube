import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserFromRequest } from '$lib/auth';
// УДАЛЕНО: import db from '$lib/db';

export const POST: RequestHandler = async (event) => {
    // ⭐ НОВОЕ: Получаем D1 Binding из event.platform.env ⭐
    const db = event.platform?.env.DB;
    if (!db) return json({ error: 'Database connection failed' }, { status: 500 });
    
    const user = getUserFromRequest(event);
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const commentId = event.params.id;
        const { type } = await event.request.json();

        if (!['like', 'dislike'].includes(type)) {
            return json({ error: 'Invalid type' }, { status: 400 });
        }

        // ⭐ D1: Проверка существующего лайка (асинхронно: .bind().first()) ⭐
        const existing = await db.prepare(
            'SELECT type FROM comment_likes WHERE comment_id = ? AND user_id = ?'
        ).bind(commentId, user.id).first() as { type: string } | null;

        if (existing) {
            if (existing.type === type) {
                // ⭐ D1: Удаление (асинхронно: .bind().run()) ⭐
                await db.prepare('DELETE FROM comment_likes WHERE comment_id = ? AND user_id = ?')
                    .bind(commentId, user.id)
                    .run();
                return json({ action: 'removed' });
            } else {
                // ⭐ D1: Обновление (асинхронно: .bind().run()) ⭐
                await db.prepare('UPDATE comment_likes SET type = ? WHERE comment_id = ? AND user_id = ?')
                    .bind(type, commentId, user.id)
                    .run();
                return json({ action: 'updated', type });
            }
        } else {
            // ⭐ D1: Вставка (асинхронно: .bind().run()) ⭐
            await db.prepare('INSERT INTO comment_likes (comment_id, user_id, type) VALUES (?, ?, ?)')
                .bind(commentId, user.id, type)
                .run();
            return json({ action: 'added', type });
        }
    } catch (error) {
        console.error('Comment like error:', error);
        return json({ error: 'Failed to like comment' }, { status: 500 });
    }
};

export const GET: RequestHandler = async (event) => {
    // ⭐ НОВОЕ: Получаем D1 Binding из event.platform.env ⭐
    const db = event.platform?.env.DB;
    if (!db) return json({ like: null }); // В GET-запросе можно просто вернуть null при ошибке БД

    const user = getUserFromRequest(event);
    if (!user) return json({ like: null });

    try {
        const commentId = event.params.id;
        // ⭐ D1: Получение лайка (асинхронно: .bind().first()) ⭐
        const like = await db.prepare(
            'SELECT type FROM comment_likes WHERE comment_id = ? AND user_id = ?'
        ).bind(commentId, user.id).first() as { type: string } | null;

        return json({ like: like?.type || null });
    } catch (error) {
        return json({ like: null });
    }
};
