import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserFromRequest } from '$lib/auth'; // Предполагаем, что этот файл не требует изменений

// Мы больше не импортируем db из $lib/db, а получаем его из platform.env

export const POST: RequestHandler = async (event) => {
    // 1. Получаем базу данных D1 из среды platform
    const db = event.platform?.env.VIBETUBE_DB;

    if (!db) {
        return json({ error: 'Database connection failed (D1 binding missing)' }, { status: 500 });
    }

    const user = getUserFromRequest(event);

    if (!user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const { videoId, type } = await event.request.json();

        if (!videoId || !type || !['like', 'dislike'].includes(type)) {
            return json({ error: 'Invalid request' }, { status: 400 });
        }

        // 2. Заменяем .get() на D1 .prepare().all() или .first()
        // .first() возвращает первую строку или null, что идеально подходит для 'SELECT *'
        const existing = await db
            .prepare('SELECT * FROM likes WHERE video_id = ? AND user_id = ?')
            .bind(videoId, user.id)
            .first<{ type: 'like' | 'dislike' }>(); // Добавляем типизацию для уверенности

        if (existing) {
            if (existing.type === type) {
                // Удаление
                await db
                    .prepare('DELETE FROM likes WHERE video_id = ? AND user_id = ?')
                    .bind(videoId, user.id)
                    .run(); // Заменяем .run()
                return json({ action: 'removed', type });
            } else {
                // Обновление
                await db
                    .prepare('UPDATE likes SET type = ? WHERE video_id = ? AND user_id = ?')
                    .bind(type, videoId, user.id)
                    .run(); // Заменяем .run()
                return json({ action: 'updated', type });
            }
        } else {
            // Вставка
            await db
                .prepare('INSERT INTO likes (video_id, user_id, type) VALUES (?, ?, ?)')
                .bind(videoId, user.id, type)
                .run(); // Заменяем .run()
            return json({ action: 'added', type });
        }
    } catch (error) {
        console.error('Like error:', error);
        return json({ error: 'Failed to process like' }, { status: 500 });
    }
};

export const GET: RequestHandler = async (event) => {
    // 1. Получаем базу данных D1 из среды platform
    const db = event.platform?.env.VIBETUBE_DB;
    
    if (!db) {
        return json({ like: null }); // В этом случае просто возвращаем null, а не 500
    }

    const user = getUserFromRequest(event);
    const videoId = event.url.searchParams.get('videoId');

    if (!user || !videoId) {
        return json({ like: null });
    }

    // 2. Заменяем .get() на D1 .prepare().first()
    const like = await db
        .prepare('SELECT type FROM likes WHERE video_id = ? AND user_id = ?')
        .bind(videoId, user.id)
        .first<{ type: string }>();

    // D1 возвращает null, если ничего не найдено
    return json({ like: like?.type || null });
};