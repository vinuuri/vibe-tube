import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
// УДАЛЯЕМ: import db from '$lib/db';
import { getUserFromRequest } from '$lib/auth';
import { sanitizeInput } from '$lib/utils';
// УДАЛЯЕМ: import { writeFile, mkdir } from 'fs/promises';
// УДАЛЯЕМ: import { join } from 'path';

export const PUT: RequestHandler = async (event) => {
    const user = getUserFromRequest(event);
    
    // ⭐ НОВОЕ: Получаем D1 и R2 Bindings из event.platform.env ⭐
    const db = event.platform?.env.DB;
    const bucket = event.platform?.env.MEDIA_BUCKET;

    if (!db || !bucket) {
        return json({ error: 'Server configuration error: Database or Storage missing' }, { status: 500 });
    }

    if (!user) {
        return json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const formData = await event.request.formData();
        const title = formData.get('title') as string;
        const description = formData.get('description') as string;
        const thumbnailFile = formData.get('thumbnail') as File | null;
        const videoId = event.params.id;

        console.log('Update video request:', { 
            videoId, 
            title, 
            hasThumbnail: !!thumbnailFile,
            thumbnailSize: thumbnailFile?.size 
        });

        if (!title) {
            return json({ error: 'Title is required' }, { status: 400 });
        }

        // Sanitize user input to prevent XSS
        const sanitizedTitle = sanitizeInput(title, 200);
        const sanitizedDescription = sanitizeInput(description || '', 5000);

        if (!sanitizedTitle.trim()) {
            return json({ error: 'Title cannot be empty' }, { status: 400 });
        }

        // ⭐ D1: Проверка существования видео и прав пользователя (асинхронно) ⭐
        const video = await db.prepare('SELECT * FROM videos WHERE id = ?')
                                .bind(videoId)
                                .first<{ user_id: number, thumbnail_url: string, thumbnail: string }>();

        if (!video) {
            return json({ error: 'Video not found' }, { status: 404 });
        }

        if (video.user_id !== user.id) {
            return json({ error: 'Forbidden' }, { status: 403 });
        }

        let thumbnailUrl = video.thumbnail_url || video.thumbnail;

        if (thumbnailFile && thumbnailFile.size > 0) {
            try {
                // ⭐ R2: Логика загрузки миниатюры ⭐
                const ext = thumbnailFile.name.split('.').pop();
                const timestamp = Date.now();
                
                // Используем ключ, который явно указывает на владельца
                const thumbnailKey = `thumbnails/${user.id}/${videoId}_${timestamp}.${ext}`;
                
                // Загрузка файла в R2
                await bucket.put(thumbnailKey, thumbnailFile.stream(), {
                    contentType: thumbnailFile.type || 'image/jpeg'
                });
                
                // URL для доступа к файлу через Worker
                thumbnailUrl = `/r2/${thumbnailKey}`; 

                console.log('Thumbnail saved:', thumbnailUrl);
            } catch (fileError: any) {
                console.error('File upload error:', fileError);
                return json({ error: 'Failed to upload thumbnail: ' + fileError.message }, { status: 500 });
            }
        }

        // ⭐ D1: Обновление видео (асинхронно) ⭐
        // Update both thumbnail fields for compatibility
        await db.prepare(`
            UPDATE videos 
            SET title = ?, description = ?, thumbnail_url = ?, thumbnail = ?
            WHERE id = ?
        `).bind(
            sanitizedTitle, 
            sanitizedDescription || null, 
            thumbnailUrl, 
            thumbnailUrl, 
            videoId
        ).run();

        // ⭐ D1: Получение обновленного видео (асинхронно) ⭐
        const updatedVideo = await db.prepare('SELECT * FROM videos WHERE id = ?')
                                     .bind(videoId)
                                     .first();

        return json({ video: updatedVideo });
    } catch (error: any) {
        console.error('Update error:', error);
        return json({ error: 'Failed to update video: ' + error.message }, { status: 500 });
    }
};
