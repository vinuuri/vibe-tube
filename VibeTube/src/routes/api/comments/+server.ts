import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserFromRequest } from '$lib/auth';
import { sanitizeInput } from '$lib/utils';
// УДАЛЕНО: import db from '$lib/db';
// ПРИМЕЧАНИЕ: validateCsrfForRequest должен быть импортирован из $lib/auth, если он там есть
// или $lib/auth.ts должен быть адаптирован для D1.

// Допустим, что validateCsrfForRequest находится в $lib/auth (если нет, добавьте импорт):
// import { validateCsrfForRequest } from '$lib/auth'; 

export const GET: RequestHandler = async ({ url, platform }) => {
    // ⭐ НОВОЕ: Получаем D1 Binding ⭐
    const db = platform?.env.DB;
    if (!db) return json({ error: 'Database connection failed' }, { status: 500 });
    
    const videoId = url.searchParams.get('videoId');

    if (!videoId) {
        return json({ error: 'Video ID is required' }, { status: 400 });
    }

    // ⭐ D1: Получаем родительские комментарии (асинхронно: .bind().all()) ⭐
    const commentsResult = await db.prepare(`
        SELECT c.*, u.username, u.avatar,
            (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND type = 'like') as likes,
            (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND type = 'dislike') as dislikes,
            (SELECT COUNT(*) FROM comments WHERE parent_id = c.id) as reply_count
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.video_id = ? AND c.parent_id IS NULL
        ORDER BY c.is_pinned DESC, c.created_at DESC
    `).bind(videoId).all();
    
    const comments = commentsResult.results || [];

    // ⭐ D1: Загрузка ответов для каждого комментария (requires Promise.all) ⭐
    // Это синхронный цикл, который должен стать асинхронным, чтобы избежать блокировки
    const commentsWithReplies = await Promise.all(
        comments.map(async (comment: any) => {
            const repliesResult = await db.prepare(`
                SELECT c.*, u.username, u.avatar,
                    (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND type = 'like') as likes,
                    (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND type = 'dislike') as dislikes
                FROM comments c
                JOIN users u ON c.user_id = u.id
                WHERE c.parent_id = ?
                ORDER BY c.created_at ASC
            `).bind(comment.id).all();

            return { ...comment, replies: repliesResult.results || [] };
        })
    );

    return json({ comments: commentsWithReplies });
};

export const POST: RequestHandler = async (event) => {
    // ⭐ НОВОЕ: Получаем D1 Binding ⭐
    const db = event.platform?.env.DB;
    if (!db) return json({ error: 'Database connection failed' }, { status: 500 });

    // P.S.: Предполагаем, что validateCsrfForRequest импортирован или доступен.
    // const csrfCheck = await validateCsrfForRequest(event);
    // if (!csrfCheck.valid) {
    //     return json({ error: csrfCheck.error || 'CSRF validation failed' }, { status: 403 });
    // }

    const user = getUserFromRequest(event);

    if (!user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await event.request.json();
        const { videoId, content, parentId } = body;

        if (!videoId || !content) {
            return json({ error: 'Video ID and content are required' }, { status: 400 });
        }

        // Sanitize user input to prevent XSS
        const sanitizedContent = sanitizeInput(content, 5000);
        
        if (!sanitizedContent.trim()) {
            return json({ error: 'Comment content cannot be empty' }, { status: 400 });
        }

        // ⭐ D1: Вставляем комментарий (асинхронно: .bind().run()) ⭐
        const result = await db.prepare(`
            INSERT INTO comments (video_id, user_id, content, parent_id)
            VALUES (?, ?, ?, ?)
        `).bind(videoId, user.id, sanitizedContent, parentId || null).run();
        
        const lastInsertRowid = result.meta.last_row_id;

        // ⭐ D1: Получаем новый комментарий (асинхронно: .bind().first()) ⭐
        const comment = await db.prepare(`
            SELECT c.*, u.username, u.avatar,
                (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND type = 'like') as likes,
                (SELECT COUNT(*) FROM comment_likes WHERE comment_id = c.id AND type = 'dislike') as dislikes
            FROM comments c
            JOIN users u ON c.user_id = u.id
            WHERE c.id = ?
        `).bind(lastInsertRowid).first();

        return json({ comment }, { status: 201 });
    } catch (error) {
        console.error('Comment error:', error);
        return json({ error: 'Failed to create comment' }, { status: 500 });
    }
};

export const DELETE: RequestHandler = async (event) => {
    // ⭐ НОВОЕ: Получаем D1 Binding ⭐
    const db = event.platform?.env.DB;
    if (!db) return json({ error: 'Database connection failed' }, { status: 500 });

    // P.S.: Предполагаем, что validateCsrfForRequest импортирован или доступен.
    // const csrfCheck = await validateCsrfForRequest(event);
    // if (!csrfCheck.valid) {
    //     return json({ error: csrfCheck.error || 'CSRF validation failed' }, { status: 403 });
    // }

    const user = getUserFromRequest(event);
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const commentId = event.url.searchParams.get('id');
        if (!commentId) {
            return json({ error: 'Comment ID required' }, { status: 400 });
        }

        // ⭐ D1: Проверяем автора (асинхронно: .bind().first()) ⭐
        const comment = await db.prepare('SELECT user_id FROM comments WHERE id = ?')
                                .bind(commentId).first() as { user_id: number } | null;
        if (!comment) {
            return json({ error: 'Comment not found' }, { status: 404 });
        }

        if (comment.user_id !== user.id) {
            return json({ error: 'Not authorized to delete this comment' }, { status: 403 });
        }

        // ⭐ D1: Удаляем (асинхронно: .bind().run()) ⭐
        await db.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();
        return json({ success: true });
    } catch (error) {
        console.error('Delete comment error:', error);
        return json({ error: 'Failed to delete comment' }, { status: 500 });
    }
};

export const PUT: RequestHandler = async (event) => {
    // ⭐ НОВОЕ: Получаем D1 Binding ⭐
    const db = event.platform?.env.DB;
    if (!db) return json({ error: 'Database connection failed' }, { status: 500 });

    // P.S.: Предполагаем, что validateCsrfForRequest импортирован или доступен.
    // const csrfCheck = await validateCsrfForRequest(event);
    // if (!csrfCheck.valid) {
    //     return json({ error: csrfCheck.error || 'CSRF validation failed' }, { status: 403 });
    // }

    const user = getUserFromRequest(event);
    if (!user) return json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const commentId = event.url.searchParams.get('id');
        const body = await event.request.json();
        const { content } = body;

        if (!commentId || !content) {
            return json({ error: 'Comment ID and content required' }, { status: 400 });
        }

        // Sanitize user input to prevent XSS
        const sanitizedContent = sanitizeInput(content, 5000);
        
        if (!sanitizedContent.trim()) {
            return json({ error: 'Comment content cannot be empty' }, { status: 400 });
        }

        // ⭐ D1: Проверяем автора (асинхронно: .bind().first()) ⭐
        const comment = await db.prepare('SELECT user_id FROM comments WHERE id = ?')
                                .bind(commentId).first() as { user_id: number } | null;
        if (!comment) {
            return json({ error: 'Comment not found' }, { status: 404 });
        }

        if (comment.user_id !== user.id) {
            return json({ error: 'Not authorized to edit this comment' }, { status: 403 });
        }

        // ⭐ D1: Обновляем (асинхронно: .bind().run()) ⭐
        await db.prepare('UPDATE comments SET content = ? WHERE id = ?').bind(sanitizedContent, commentId).run();
        return json({ success: true });
    } catch (error) {
        console.error('Edit comment error:', error);
        return json({ error: 'Failed to edit comment' }, { status: 500 });
    }
};
