import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserFromRequest } from '$lib/auth';
// УДАЛЕНО: import db from '$lib/db';

export const DELETE: RequestHandler = async (event) => {
    // ⭐ НОВОЕ: Получаем D1 Binding из event.platform.env ⭐
    const db = event.platform?.env.DB;
    if (!db) return json({ error: 'Database connection failed' }, { status: 500 });
    
    const user = getUserFromRequest(event);
    if (!user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const commentId = event.params.id;
        
        if (!commentId) {
            return json({ error: 'Comment ID required' }, { status: 400 });
        }

        // ⭐ D1: Получаем информацию о комментарии и владельце видео (асинхронно: .bind().first()) ⭐
        const comment = await db.prepare(`
            SELECT c.user_id, c.video_id, v.user_id as video_owner_id 
            FROM comments c
            JOIN videos v ON c.video_id = v.id
            WHERE c.id = ?
        `).bind(commentId).first() as { user_id: number, video_id: number, video_owner_id: number } | null;

        if (!comment) {
            return json({ error: 'Comment not found' }, { status: 404 });
        }

        // Разрешаем удаление, если пользователь — автор комментария ИЛИ владелец видео
        if (comment.user_id !== user.id && comment.video_owner_id !== user.id) {
            return json({ error: 'Not authorized to delete this comment' }, { status: 403 });
        }

        // ⭐ D1: Удаляем комментарий (асинхронно: .bind().run()) ⭐
        // (Реплики удалятся автоматически благодаря CASCADE в SQL_SCHEMA)
        await db.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();
        
        return json({ success: true });
    } catch (error) {
        console.error('Delete comment error:', error);
        return json({ error: 'Failed to delete comment' }, { status: 500 });
    }
};

export const PUT: RequestHandler = async (event) => {
    // ⭐ НОВОЕ: Получаем D1 Binding из event.platform.env ⭐
    const db = event.platform?.env.DB;
    if (!db) return json({ error: 'Database connection failed' }, { status: 500 });
    
    const user = getUserFromRequest(event);
    if (!user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const commentId = event.params.id;
        const { content } = await event.request.json();

        if (!commentId || !content) {
            return json({ error: 'Comment ID and content required' }, { status: 400 });
        }

        // ⭐ D1: Проверяем, является ли пользователь автором (асинхронно: .bind().first()) ⭐
        const comment = await db.prepare('SELECT user_id FROM comments WHERE id = ?')
                                .bind(commentId).first() as { user_id: number } | null;
        
        if (!comment) {
            return json({ error: 'Comment not found' }, { status: 404 });
        }

        if (comment.user_id !== user.id) {
            return json({ error: 'Not authorized to edit this comment' }, { status: 403 });
        }

        // ⭐ D1: Обновляем содержимое (асинхронно: .bind().run()) ⭐
        await db.prepare('UPDATE comments SET content = ? WHERE id = ?').bind(content, commentId).run();
        
        return json({ success: true });
    } catch (error) {
        console.error('Edit comment error:', error);
        return json({ error: 'Failed to edit comment' }, { status: 500 });
    }
};
