// src/routes/api/videos/+server.ts

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserFromRequest } from '$lib/auth';
import { sanitizeInput } from '$lib/utils';
// УДАЛЕНЫ: child_process, util, fs/promises, и функция getVideoDuration

// ====================================================================
// GET Request Handler (Остается как в предыдущей версии D1)
// ====================================================================

export const GET: RequestHandler = async (event) => {
    // Получаем D1 Binding из platform
    const db = event.platform?.env.VIBETUBE_DB;
    if (!db) return json({ error: 'Database connection failed' }, { status: 500 });
    
    const { url } = event;
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const search = url.searchParams.get('search') || '';
    const userId = url.searchParams.get('userId');

    let query = `
        SELECT 
            v.*,
            u.username,
            u.avatar as user_avatar,
            u.banner,
            (SELECT COUNT(*) FROM likes WHERE video_id = v.id AND type = 'like') as likes,
            (SELECT COUNT(*) FROM likes WHERE video_id = v.id AND type = 'dislike') as dislikes
        FROM videos v
        JOIN users u ON v.user_id = u.id
    `;

    const params: (string | number)[] = [];

    if (userId) {
        query += ' WHERE v.user_id = ?';
        params.push(userId);
    } else if (search) {
        query += ' WHERE v.title LIKE ? OR v.description LIKE ?';
        params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY v.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const { results: videos } = await db.prepare(query).bind(...params).all();

    return json({ videos });
};


// ====================================================================
// POST Request Handler (Адаптирован для получения длительности с клиента и R2)
// ====================================================================

export const POST: RequestHandler = async (event) => {
    // Получаем D1 Binding и R2 Binding из platform
    const db = event.platform?.env.VIBETUBE_DB;
    const bucket = event.platform?.env.MEDIA_BUCKET; 
    
    if (!db || !bucket) {
        return json({ error: 'Server configuration error: Database or Storage missing' }, { status: 500 });
    }

    const user = getUserFromRequest(event);

    if (!user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await event.request.formData();
        const title = formData.get('title') as string;
        const description = formData.get('description') as string;
        
        // ⭐ НОВОЕ: Получаем длительность с клиента (в виде строки) ⭐
        const durationStr = formData.get('duration') as string; 
        
        const videoFile = formData.get('video') as File;
        const thumbnailFile = formData.get('thumbnail') as File;

        if (!title || !videoFile) {
            return json({ error: 'Title and video are required' }, { status: 400 });
        }

        // Санитизация ввода
        const sanitizedTitle = sanitizeInput(title, 200);
        const sanitizedDescription = sanitizeInput(description || '', 5000);

        if (!sanitizedTitle.trim()) {
            return json({ error: 'Title cannot be empty' }, { status: 400 });
        }

        const videoExt = videoFile.name.split('.').pop();
        const thumbnailExt = thumbnailFile?.name.split('.').pop();
        const timestamp = Date.now();

        // 1. Создаем ключи R2
        const videoKey = `videos/${user.id}/${timestamp}.${videoExt}`;
        const thumbnailKey = thumbnailFile ? `thumbnails/${user.id}/${timestamp}.${thumbnailExt}` : null;
        
        // 2. ЗАГРУЗКА ВИДЕО В R2
        await bucket.put(videoKey, videoFile.stream(), {
            // Устанавливаем правильный ContentType, если он не определен автоматически
            contentType: videoFile.type || 'video/mp4' 
        });

        // 3. ЗАГРУЗКА МИНИАТЮРЫ В R2 (если есть)
        if (thumbnailFile && thumbnailKey) {
            await bucket.put(thumbnailKey, thumbnailFile.stream(), {
                contentType: thumbnailFile.type || 'image/jpeg'
            });
        }

        // 4. ⭐ ПРЕОБРАЗОВАНИЕ ДЛИТЕЛЬНОСТИ ⭐
        const duration = parseInt(durationStr) || 0; 
        
        // 5. ВСТАВКА В D1
        const videoUrl = `/r2/${videoKey}`;
        const thumbnailUrl = thumbnailKey ? `/r2/${thumbnailKey}` : null;

        const result = await db.prepare(`
            INSERT INTO videos (user_id, title, description, video_url, thumbnail_url, thumbnail, duration, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).bind(
            user.id,
            sanitizedTitle,
            sanitizedDescription,
            videoUrl,
            thumbnailUrl,
            thumbnailUrl,
            duration,
            timestamp // Добавил timestamp, если это поле есть в БД
        ).run();
        
        const insertedId = result.meta.last_row_id;
        
        const video = await db.prepare(`
            SELECT v.*, u.username, u.avatar as user_avatar
            FROM videos v
            JOIN users u ON v.user_id = u.id
            WHERE v.id = ?
        `).bind(insertedId).get();

        return json({ video }, { status: 201 });
    } catch (error) {
        console.error('Upload error:', error);
        return json({ error: 'Upload failed' }, { status: 500 });
    }
};
