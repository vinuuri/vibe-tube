import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import db from '$lib/db';
import { getUserFromRequest } from '$lib/auth';
import { sanitizeInput } from '$lib/utils';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export const PUT: RequestHandler = async (event) => {
	const user = getUserFromRequest(event);

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

		const existing = db.prepare(
			'SELECT id FROM users WHERE (username = ? OR email = ?) AND id != ?'
		).get(sanitizedUsername, sanitizedEmail, user.id);

		if (existing) {
			return json({ error: 'Username or email already taken' }, { status: 409 });
		}

		const uploadsDir = join(process.cwd(), 'static', 'uploads', 'users');
		await mkdir(uploadsDir, { recursive: true });

		let avatarUrl = null;
		let bannerUrl = null;

		if (avatarFile && avatarFile.size > 0) {
			const avatarExt = avatarFile.name.split('.').pop();
			const avatarFilename = `avatar_${user.id}_${Date.now()}.${avatarExt}`;
			const avatarPath = join(uploadsDir, avatarFilename);
			const avatarBuffer = Buffer.from(await avatarFile.arrayBuffer());
			await writeFile(avatarPath, avatarBuffer);
			avatarUrl = `/uploads/users/${avatarFilename}`;
		}

		if (bannerFile && bannerFile.size > 0) {
			const bannerExt = bannerFile.name.split('.').pop();
			const bannerFilename = `banner_${user.id}_${Date.now()}.${bannerExt}`;
			const bannerPath = join(uploadsDir, bannerFilename);
			const bannerBuffer = Buffer.from(await bannerFile.arrayBuffer());
			await writeFile(bannerPath, bannerBuffer);
			bannerUrl = `/uploads/users/${bannerFilename}`;
		}

		const currentUser = db.prepare('SELECT avatar, banner FROM users WHERE id = ?').get(user.id) as any;

		db.prepare(`
			UPDATE users 
			SET username = ?, email = ?, description = ?, avatar = ?, banner = ?
			WHERE id = ?
		`).run(
			sanitizedUsername, 
			sanitizedEmail, 
			sanitizedDescription || null, 
			avatarUrl || currentUser.avatar, 
			bannerUrl || currentUser.banner, 
			user.id
		);

		const updatedUser = db.prepare(`
			SELECT id, username, email, avatar, banner, description, created_at
			FROM users WHERE id = ?
		`).get(user.id);

		return json({ user: updatedUser });
	} catch (error) {
		console.error('Update error:', error);
		return json({ error: 'Failed to update profile' }, { status: 500 });
	}
};
