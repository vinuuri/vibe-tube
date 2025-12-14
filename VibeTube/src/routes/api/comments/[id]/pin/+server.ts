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

        // ⭐ D1: Получаем комментарий и автора видео (асинхронно: .bind().first()) ⭐
        const comment = await db.prepare(`
            SELECT c.*, v.user_id as video_author_id
            FROM comments c
            JOIN videos v ON c.video_id = v.id
            WHERE c.id = ?
        `).bind(commentId).first() as { is_pinned: number, video_author_id: number, video_id: number } | null;

        if (!comment) {
            return json({ error: 'Comment not found' }, { status: 404 });
        }

        if (comment.video_author_id !== user.id) {
            return json({ error: 'Only video author can pin comments' }, { status: 403 });
        }

        // ⭐ D1: Открепляем все остальные комментарии на этом видео (асинхронно: .bind().run()) ⭐
        // Это нужно делать, чтобы только один комментарий был закреплен
        await db.prepare('UPDATE comments SET is_pinned = 0 WHERE video_id = ?').bind(comment.video_id).run();

        // Переключаем закрепление для этого комментария
        const newPinned = comment.is_pinned ? 0 : 1;
        
        // ⭐ D1: Обновляем статус закрепления (асинхронно: .bind().run()) ⭐
        await db.prepare('UPDATE comments SET is_pinned = ? WHERE id = ?').bind(newPinned, commentId).run();

        return json({ is_pinned: newPinned });
    } catch (error) {
        console.error('Pin error:', error);
        return json({ error: 'Failed to pin comment' }, { status: 500 });
    }
};
