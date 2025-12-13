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
        const username = formData.get('username') as string;
        const email = formData.get('email') as string;
        const description = formData.get('description') as string;
        const avatarFile = formData.get('avatar') as File | null;
        const bannerFile = formData.get('banner') as File | null;
        
        // ... (Валидация остается прежней)

        if (!username || !email) {
            return json({ error: 'Username and email are required' }, { status: 400 });
        }

        // Sanitize user input to prevent XSS
        const sanitizedUsername = sanitizeInput(username, 50);
        const sanitizedEmail = sanitizeInput(email, 100);
        const sanitizedDescription = sanitizeInput(description || '', 500);

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(sanitizedEmail)) {
            return json({ error: 'Invalid email format' }, { status: 400 });
        }

        if (!sanitizedUsername.trim()) {
            return json({ error: 'Username cannot be empty' }, { status: 400 });
        }

        // ⭐ D1: Проверка существующего пользователя (асинхронно) ⭐
        const existing = await db.prepare(
            'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?'
        ).bind(sanitizedUsername, sanitizedEmail, user.id).get();

        if (existing) {
            return json({ error: 'Username or email already taken' }, { status: 409 });
        }

        // ⭐ D1: Получаем текущие URL для использования по умолчанию ⭐
        const currentUser = await db.prepare(
            'SELECT avatar, banner FROM users WHERE id = ?'
        ).bind(user.id).first() as { avatar: string | null, banner: string | null };

        // УДАЛЯЕМ: uploadsDir и mkdir (R2 не требует предварительного создания папок)
        
        let avatarUrl = null;
        let bannerUrl = null;
        const timestamp = Date.now();

        if (avatarFile && avatarFile.size > 0) {
            const avatarExt = avatarFile.name.split('.').pop();
            // ⭐ R2: Определяем ключ бакета ⭐
            const avatarKey = `users/avatars/${user.id}_${timestamp}.${avatarExt}`;
            
            // ⭐ R2: Загрузка файла (используем put) ⭐
            await bucket.put(avatarKey, avatarFile.stream(), {
                contentType: avatarFile.type || 'image/jpeg'
            });
            // URL, который Worker должен проксировать к R2
            avatarUrl = `/r2/${avatarKey}`;
        }

        if (bannerFile && bannerFile.size > 0) {
            const bannerExt = bannerFile.name.split('.').pop();
            // ⭐ R2: Определяем ключ бакета ⭐
            const bannerKey = `users/banners/${user.id}_${timestamp}.${bannerExt}`;
            
            // ⭐ R2: Загрузка файла (используем put) ⭐
            await bucket.put(bannerKey, bannerFile.stream(), {
                contentType: bannerFile.type || 'image/jpeg'
            });
            // URL, который Worker должен проксировать к R2
            bannerUrl = `/r2/${bannerKey}`;
        }

        // ⭐ D1: Обновление пользователя (асинхронно) ⭐
        await db.prepare(`
            UPDATE users 
            SET username = ?, email = ?, description = ?, avatar = ?, banner = ?
            WHERE id = ?
        `).bind(
            sanitizedUsername, 
            sanitizedEmail, 
            sanitizedDescription || null, 
            avatarUrl || currentUser.avatar, 
            bannerUrl || currentUser.banner, 
            user.id
        ).run();

        // ⭐ D1: Получение обновленного пользователя (асинхронно) ⭐
        const updatedUser = await db.prepare(`
            SELECT id, username, email, avatar, banner, description, created_at
            FROM users WHERE id = ?
        `).bind(user.id).get();

        return json({ user: updatedUser });
    } catch (error) {
        console.error('Update error:', error);
        return json({ error: 'Failed to update profile' }, { status: 500 });
    }
};
