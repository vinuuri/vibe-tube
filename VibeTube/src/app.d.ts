// src/app.d.ts

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

// 1. Объявляем глобальный интерфейс Env, содержащий D1 Database binding.
interface Env {
    // ⭐ ИСПРАВЛЕНИЕ 1: Имя должно совпадать с binding = "DB" в wrangler.toml, 
    // а тип должен быть D1Database.
    DB: D1Database;
    // ⭐ ИСПРАВЛЕНИЕ 2: R2Bucket должен быть доступен (зависит от app.d.ts)
    MEDIA_BUCKET: R2Bucket; 
}

declare global {
    namespace App {
        // interface Error {}
        // interface Locals {}
        // interface PageData {}
        // interface PageState {}
        
        // 2. Объявляем интерфейс Platform для Cloudflare Pages/Workers.
        interface Platform {
            env: Env;
            context: {
                waitUntil(promise: Promise<any>): void;
                passThroughOnException(): void;
            }
        }
    }
    // ⭐ Убедитесь, что D1Database и R2Bucket доступны глобально ⭐
    // (Они предоставляются @cloudflare/workers-types, или через объявление в этом файле)
    interface D1Database {} // Добавляем заглушку, если не импортируется
    interface R2Bucket {} // Добавляем заглушку, если не импортируется
}

export {};