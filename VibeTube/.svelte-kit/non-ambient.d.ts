
// this file is generated — do not edit it


declare module "svelte/elements" {
	export interface HTMLAttributes<T> {
		'data-sveltekit-keepfocus'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-noscroll'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-preload-code'?:
			| true
			| ''
			| 'eager'
			| 'viewport'
			| 'hover'
			| 'tap'
			| 'off'
			| undefined
			| null;
		'data-sveltekit-preload-data'?: true | '' | 'hover' | 'tap' | 'off' | undefined | null;
		'data-sveltekit-reload'?: true | '' | 'off' | undefined | null;
		'data-sveltekit-replacestate'?: true | '' | 'off' | undefined | null;
	}
}

export {};


declare module "$app/types" {
	export interface AppTypes {
		RouteId(): "/" | "/api" | "/api/auth" | "/api/auth/login" | "/api/auth/logout" | "/api/auth/me" | "/api/auth/register" | "/api/comments" | "/api/comments/[id]" | "/api/comments/[id]/heart" | "/api/comments/[id]/like" | "/api/comments/[id]/pin" | "/api/liked" | "/api/liked/videos" | "/api/likes" | "/api/studio" | "/api/studio/comments" | "/api/studio/stats" | "/api/subscriptions" | "/api/users" | "/api/users/[id]" | "/api/user" | "/api/user/update" | "/api/videos" | "/api/videos/[id]" | "/api/videos/[id]/update" | "/api/watch-history" | "/channel" | "/channel/[id]" | "/history" | "/liked" | "/login" | "/my-videos" | "/register" | "/search" | "/settings" | "/studio" | "/studio/analytics" | "/studio/comments" | "/studio/edit" | "/studio/edit/[id]" | "/studio/videos" | "/trending" | "/upload" | "/watch-later" | "/watch" | "/watch/[id]";
		RouteParams(): {
			"/api/comments/[id]": { id: string };
			"/api/comments/[id]/heart": { id: string };
			"/api/comments/[id]/like": { id: string };
			"/api/comments/[id]/pin": { id: string };
			"/api/users/[id]": { id: string };
			"/api/videos/[id]": { id: string };
			"/api/videos/[id]/update": { id: string };
			"/channel/[id]": { id: string };
			"/studio/edit/[id]": { id: string };
			"/watch/[id]": { id: string }
		};
		LayoutParams(): {
			"/": { id?: string };
			"/api": { id?: string };
			"/api/auth": Record<string, never>;
			"/api/auth/login": Record<string, never>;
			"/api/auth/logout": Record<string, never>;
			"/api/auth/me": Record<string, never>;
			"/api/auth/register": Record<string, never>;
			"/api/comments": { id?: string };
			"/api/comments/[id]": { id: string };
			"/api/comments/[id]/heart": { id: string };
			"/api/comments/[id]/like": { id: string };
			"/api/comments/[id]/pin": { id: string };
			"/api/liked": Record<string, never>;
			"/api/liked/videos": Record<string, never>;
			"/api/likes": Record<string, never>;
			"/api/studio": Record<string, never>;
			"/api/studio/comments": Record<string, never>;
			"/api/studio/stats": Record<string, never>;
			"/api/subscriptions": Record<string, never>;
			"/api/users": { id?: string };
			"/api/users/[id]": { id: string };
			"/api/user": { id?: string };
			"/api/user/update": Record<string, never>;
			"/api/videos": { id?: string };
			"/api/videos/[id]": { id: string };
			"/api/videos/[id]/update": { id: string };
			"/api/watch-history": Record<string, never>;
			"/channel": { id?: string };
			"/channel/[id]": { id: string };
			"/history": Record<string, never>;
			"/liked": Record<string, never>;
			"/login": Record<string, never>;
			"/my-videos": Record<string, never>;
			"/register": Record<string, never>;
			"/search": Record<string, never>;
			"/settings": Record<string, never>;
			"/studio": { id?: string };
			"/studio/analytics": Record<string, never>;
			"/studio/comments": Record<string, never>;
			"/studio/edit": { id?: string };
			"/studio/edit/[id]": { id: string };
			"/studio/videos": Record<string, never>;
			"/trending": Record<string, never>;
			"/upload": Record<string, never>;
			"/watch-later": Record<string, never>;
			"/watch": { id?: string };
			"/watch/[id]": { id: string }
		};
		Pathname(): "/" | "/api" | "/api/" | "/api/auth" | "/api/auth/" | "/api/auth/login" | "/api/auth/login/" | "/api/auth/logout" | "/api/auth/logout/" | "/api/auth/me" | "/api/auth/me/" | "/api/auth/register" | "/api/auth/register/" | "/api/comments" | "/api/comments/" | `/api/comments/${string}` & {} | `/api/comments/${string}/` & {} | `/api/comments/${string}/heart` & {} | `/api/comments/${string}/heart/` & {} | `/api/comments/${string}/like` & {} | `/api/comments/${string}/like/` & {} | `/api/comments/${string}/pin` & {} | `/api/comments/${string}/pin/` & {} | "/api/liked" | "/api/liked/" | "/api/liked/videos" | "/api/liked/videos/" | "/api/likes" | "/api/likes/" | "/api/studio" | "/api/studio/" | "/api/studio/comments" | "/api/studio/comments/" | "/api/studio/stats" | "/api/studio/stats/" | "/api/subscriptions" | "/api/subscriptions/" | "/api/users" | "/api/users/" | `/api/users/${string}` & {} | `/api/users/${string}/` & {} | "/api/user" | "/api/user/" | "/api/user/update" | "/api/user/update/" | "/api/videos" | "/api/videos/" | `/api/videos/${string}` & {} | `/api/videos/${string}/` & {} | `/api/videos/${string}/update` & {} | `/api/videos/${string}/update/` & {} | "/api/watch-history" | "/api/watch-history/" | "/channel" | "/channel/" | `/channel/${string}` & {} | `/channel/${string}/` & {} | "/history" | "/history/" | "/liked" | "/liked/" | "/login" | "/login/" | "/my-videos" | "/my-videos/" | "/register" | "/register/" | "/search" | "/search/" | "/settings" | "/settings/" | "/studio" | "/studio/" | "/studio/analytics" | "/studio/analytics/" | "/studio/comments" | "/studio/comments/" | "/studio/edit" | "/studio/edit/" | `/studio/edit/${string}` & {} | `/studio/edit/${string}/` & {} | "/studio/videos" | "/studio/videos/" | "/trending" | "/trending/" | "/upload" | "/upload/" | "/watch-later" | "/watch-later/" | "/watch" | "/watch/" | `/watch/${string}` & {} | `/watch/${string}/` & {};
		ResolvedPathname(): `${"" | `/${string}`}${ReturnType<AppTypes['Pathname']>}`;
		Asset(): "/logo.png" | "/robots.txt" | "/uploads/.gitkeep" | "/uploads/thumb_1_1765318048665.png" | "/uploads/users/avatar_1_1765317942114.png" | "/uploads/users/banner_1_1765317952919.png" | "/uploads/video_1_1765318002497.webm" | string & {};
	}
}