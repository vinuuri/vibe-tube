// src/app.d.ts

// See https://svelte.dev/docs/kit/types#app.d.ts
// for information about these interfaces

// 1. Объявляем глобальный интерфейс Env, содержащий D1 Database binding.
interface Env {
    // VIBETUBE_DB должен совпадать с "binding" в файле wrangler.toml
    VIBETUBE_DB: DB;
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
}

export {};
