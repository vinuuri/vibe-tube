const SQL_SCHEMA = `
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        avatar TEXT,
        banner TEXT,
        description TEXT,
        created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%S', 'NOW'))
    );

    CREATE TABLE IF NOT EXISTS videos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        video_url TEXT NOT NULL,
        thumbnail_url TEXT,
        thumbnail TEXT,
        duration INTEGER DEFAULT 0,
        views INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%S', 'NOW')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        parent_id INTEGER,
        content TEXT NOT NULL,
        is_pinned INTEGER DEFAULT 0,
        is_hearted INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%S', 'NOW')),
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS comment_likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        comment_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        type TEXT CHECK(type IN ('like', 'dislike')) NOT NULL,
        created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%S', 'NOW')),
        UNIQUE(comment_id, user_id),
        FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS likes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        video_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        type TEXT CHECK(type IN ('like', 'dislike')) NOT NULL,
        created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%S', 'NOW')),
        UNIQUE(video_id, user_id),
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        subscriber_id INTEGER NOT NULL,
        channel_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%S', 'NOW')),
        UNIQUE(subscriber_id, channel_id),
        FOREIGN KEY (subscriber_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (channel_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS watch_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        video_id INTEGER NOT NULL,
        watched_at DATETIME DEFAULT (STRFTIME('%Y-%m-%d %H:%M:%S', 'NOW')),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_videos_user_id ON videos(user_id);
    CREATE INDEX IF NOT EXISTS idx_comments_video_id ON comments(video_id);
    CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON comments(parent_id);
    CREATE INDEX IF NOT EXISTS idx_likes_video_id ON likes(video_id);
    CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON comment_likes(comment_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber_id);
    CREATE INDEX IF NOT EXISTS idx_subscriptions_channel ON subscriptions(channel_id);
    CREATE INDEX IF NOT EXISTS idx_watch_history_user ON watch_history(user_id);
`;

/**
 * Инициализирует схему D1 базы данных (если не существует).
 * @param db Объект D1Database, полученный из платформы Worker.
 */
export async function initDatabase(db: D1Database): Promise<void> {
    try {
        await (db.exec as any)(SQL_SCHEMA); 
        console.log('✅ Database schema initialized successfully on D1.');
    } catch (e) {
        console.error('❌ Failed to initialize D1 database schema:', e);
        throw e;
    }
}
