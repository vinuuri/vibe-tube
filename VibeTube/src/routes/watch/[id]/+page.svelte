<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import { ThumbsUp, ThumbsDown, TrendingUp, Edit2, Share2, Copy, Check, Facebook, Twitter, MessageCircle, Code } from 'lucide-svelte';
	import Header from '$lib/components/Header.svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import Comments from '$lib/components/Comments.svelte';
	import VideoGrid from '$lib/components/VideoGrid.svelte';
	import { formatViews, formatTimeAgo } from '$lib/utils';
	import { language, translations } from '$lib/i18n';

	function clickOutside(node: HTMLElement, callback: () => void) {
		const handleClick = (event: MouseEvent) => {
			if (!node.contains(event.target as Node)) {
				callback();
			}
		};

		document.addEventListener('click', handleClick, true);

		return {
			destroy() {
				document.removeEventListener('click', handleClick, true);
			}
		};
	}

	let video: any = null;
	let recommendations: any[] = [];
	let user: any = null;
	let sidebarOpen = false;
	let userLike: string | null = null;
	let isSubscribed = false;
	let loading = true;
	let currentLang: 'en' | 'ru' = 'en';
	let shareMenuOpen = false;
	let linkCopied = false;
	let embedCode = '';

	language.subscribe(lang => {
		currentLang = lang;
	});

	$: t = translations[currentLang];
	$: videoId = $page.params.id;

	onMount(async () => {
		await loadVideo();
	});

	async function loadVideo() {
		loading = true;

		try {
			const userRes = await fetch('/api/auth/me');
			if (userRes.ok) {
				const userData = await userRes.json();
				user = userData.user;
			}
		} catch (e) {}

		const res = await fetch(`/api/videos/${videoId}`);
		if (res.ok) {
			const data = await res.json();
			video = data.video;

			if (user && videoId) {
				await fetch('/api/watch-history', {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ videoId })
				});
			}

			if (user) {
				const likeRes = await fetch(`/api/likes?videoId=${videoId}`);
				if (likeRes.ok) {
					const likeData = await likeRes.json();
					userLike = likeData.like;
				}

				const subRes = await fetch(`/api/subscriptions?channelId=${video.user_id}`);
				if (subRes.ok) {
					const subData = await subRes.json();
					isSubscribed = subData.subscribed;
				}
			}
		}

		const recsRes = await fetch('/api/videos?limit=10');
		if (recsRes.ok) {
			const recsData = await recsRes.json();
			if (videoId) {
				recommendations = recsData.videos.filter((v: any) => v.id !== parseInt(videoId));
			} else {
				recommendations = recsData.videos;
			}
		}

		loading = false;
	}

	async function handleLike(type: 'like' | 'dislike') {
		if (!user) {
			window.location.href = '/login';
			return;
		}

		const res = await fetch('/api/likes', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ videoId, type })
		});

		if (res.ok) {
			const data = await res.json();
			if (data.action === 'removed') {
				userLike = null;
			} else {
				userLike = type;
			}
			await loadVideo();
		}
	}

	async function handleSubscribe() {
		if (!user) {
			window.location.href = '/login';
			return;
		}

		const res = await fetch('/api/subscriptions', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ channelId: video.user_id })
		});

		if (res.ok) {
			const data = await res.json();
			isSubscribed = data.subscribed;
			await loadVideo();
		}
	}

	function getVideoUrl(): string {
		if (typeof window === 'undefined') return '';
		return `${window.location.origin}/watch/${videoId}`;
	}

	function getVideoTitle(): string {
		return video?.title || 'Video';
	}

	async function copyToClipboard(text: string) {
		try {
			await navigator.clipboard.writeText(text);
			linkCopied = true;
			setTimeout(() => {
				linkCopied = false;
			}, 2000);
		} catch (err) {
			// Fallback for older browsers
			const textArea = document.createElement('textarea');
			textArea.value = text;
			document.body.appendChild(textArea);
			textArea.select();
			document.execCommand('copy');
			document.body.removeChild(textArea);
			linkCopied = true;
			setTimeout(() => {
				linkCopied = false;
			}, 2000);
		}
	}

	function handleCopyLink() {
		const url = getVideoUrl();
		copyToClipboard(url);
	}

	function handleShareOnTwitter() {
		const url = getVideoUrl();
		const title = getVideoTitle();
		const twitterUrl = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
		window.open(twitterUrl, '_blank', 'width=550,height=420');
		shareMenuOpen = false;
	}

	function handleShareOnFacebook() {
		const url = getVideoUrl();
		const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
		window.open(facebookUrl, '_blank', 'width=550,height=420');
		shareMenuOpen = false;
	}

	function handleShareOnTelegram() {
		const url = getVideoUrl();
		const title = getVideoTitle();
		const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`;
		window.open(telegramUrl, '_blank', 'width=550,height=420');
		shareMenuOpen = false;
	}

	function handleEmbed() {
		const url = getVideoUrl();
		embedCode = `<iframe src="${url}" width="560" height="315" frameborder="0" allowfullscreen></iframe>`;
		copyToClipboard(embedCode);
	}
</script>

<div class="app">
	<Header {user} onMenuClick={() => (sidebarOpen = !sidebarOpen)} />
	<Sidebar isOpen={sidebarOpen} {user} />
	<main class:sidebar-open={sidebarOpen}>
		{#if loading}
			<div class="loading">{t.loading}</div>
		{:else if video}
			<div class="watch-layout">
				<div class="primary">
					<div class="player">
						<video controls>
							<source src={video.video_url} type="video/mp4" />
							<track kind="captions" />
						</video>
					</div>

					<div class="video-info">
						<h1>{video.title}</h1>
						<div class="video-meta">
							<div class="channel-info">
								<a href="/channel/{video.user_id}" class="channel">
									<img src={video.user_avatar} alt={video.username} />
									<div>
										<h3>{video.username}</h3>
										<p>{formatViews(video.subscribers)} {t.subscribers}</p>
									</div>
								</a>
								{#if user && video.user_id === user.id}
									<div class="author-actions">
										<a href="/studio/analytics" class="btn-secondary">
											<TrendingUp size={18} />
											{t.analytics}
										</a>
										<a href="/studio/edit/{video.id}" class="btn-primary">
											<Edit2 size={18} />
											{t.editVideo}
										</a>
									</div>
								{:else if user}
									<button class="btn-primary" class:subscribed={isSubscribed} on:click={handleSubscribe}>
										{isSubscribed ? t.subscribed : t.subscribe}
									</button>
								{/if}
							</div>
							<div class="actions">
								<button class="action-btn" class:active={userLike === 'like'} on:click={() => handleLike('like')}>
									<ThumbsUp size={20} />
									{video.likes}
								</button>
								<button class="action-btn" class:active={userLike === 'dislike'} on:click={() => handleLike('dislike')}>
									<ThumbsDown size={20} />
									{video.dislikes}
								</button>
								<div class="share-wrapper">
									<button class="action-btn" on:click={() => shareMenuOpen = !shareMenuOpen}>
										<Share2 size={20} />
										{t.share}
									</button>
									{#if shareMenuOpen}
										<div class="share-menu" use:clickOutside={() => shareMenuOpen = false}>
											<button class="share-menu-item" on:click={handleCopyLink}>
												{#if linkCopied}
													<Check size={18} />
													<span>{t.linkCopied}</span>
												{:else}
													<Copy size={18} />
													<span>{t.copyLink}</span>
												{/if}
											</button>
											<button class="share-menu-item" on:click={handleShareOnTwitter}>
												<Twitter size={18} />
												<span>{t.shareOnTwitter}</span>
											</button>
											<button class="share-menu-item" on:click={handleShareOnFacebook}>
												<Facebook size={18} />
												<span>{t.shareOnFacebook}</span>
											</button>
											<button class="share-menu-item" on:click={handleShareOnTelegram}>
												<MessageCircle size={18} />
												<span>{t.shareOnTelegram}</span>
											</button>
											<button class="share-menu-item" on:click={handleEmbed}>
												<Code size={18} />
												<span>{t.embedVideo}</span>
											</button>
										</div>
									{/if}
								</div>
							</div>
						</div>
					</div>

					<div class="description">
						<div class="stats">
							{formatViews(video.views)} {t.views} • {formatTimeAgo(video.created_at, currentLang)}
						</div>
						<p>{video.description || (currentLang === 'ru' ? 'Нет описания' : 'No description')}</p>
					</div>

					<Comments videoId={video.id} {user} videoAuthorId={video.user_id} />
				</div>

				<div class="secondary">
					<VideoGrid videos={recommendations} compact />
				</div>
			</div>
		{:else}
			<div class="error">{currentLang === 'ru' ? 'Видео не найдено' : 'Video not found'}</div>
		{/if}
	</main>
</div>

<style>
	.app {
		min-height: 100vh;
	}

	main {
		margin-top: 56px;
		margin-left: 0;
		transition: margin-left 0.3s;
	}

	main.sidebar-open {
		margin-left: 240px;
	}

	.watch-layout {
		display: flex;
		gap: 24px;
		padding: 24px;
		max-width: 1920px;
		margin: 0 auto;
	}

	.primary {
		flex: 1;
		min-width: 0;
	}

	.secondary {
		width: 400px;
		flex-shrink: 0;
	}

	.player {
		background: #000;
		border-radius: 12px;
		overflow: hidden;
		aspect-ratio: 16 / 9;
	}

	.player video {
		width: 100%;
		height: 100%;
	}

	.video-info {
		margin-top: 16px;
	}

	h1 {
		font-size: 20px;
		font-weight: 500;
		margin-bottom: 12px;
	}

	.video-meta {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 16px;
		flex-wrap: wrap;
	}

	.channel-info {
		display: flex;
		align-items: center;
		gap: 16px;
	}

	.channel {
		display: flex;
		align-items: center;
		gap: 12px;
		text-decoration: none;
		color: var(--text-primary);
	}

	.channel img {
		width: 40px;
		height: 40px;
		border-radius: 50%;
	}

	.channel h3 {
		font-size: 15px;
		font-weight: 500;
	}

	.channel p {
		font-size: 12px;
		color: var(--text-secondary);
	}

	.subscribed {
		background: var(--bg-secondary) !important;
	}

	.author-actions {
		display: flex;
		gap: 12px;
	}

	.author-actions a {
		display: flex;
		align-items: center;
		gap: 8px;
		text-decoration: none;
	}

	.actions {
		display: flex;
		gap: 8px;
	}

	.action-btn {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 10px 16px;
		background: var(--bg-secondary);
		border-radius: 20px;
		font-weight: 500;
		transition: background 0.2s;
	}

	.action-btn:hover {
		background: var(--bg-hover);
	}

	.action-btn.active {
		color: var(--accent);
	}

	.share-wrapper {
		position: relative;
	}

	.share-menu {
		position: absolute;
		top: calc(100% + 8px);
		right: 0;
		background: var(--bg-secondary);
		border: 1px solid var(--border);
		border-radius: 8px;
		padding: 8px;
		min-width: 200px;
		z-index: 100;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.share-menu-item {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 10px 12px;
		background: none;
		border: none;
		border-radius: 6px;
		color: var(--text-primary);
		font-size: 14px;
		cursor: pointer;
		text-align: left;
		transition: background 0.2s;
		width: 100%;
	}

	.share-menu-item:hover {
		background: var(--bg-hover);
	}

	.share-menu-item span {
		flex: 1;
	}

	.description {
		background: var(--bg-secondary);
		padding: 16px;
		border-radius: 12px;
		margin-top: 16px;
	}

	.stats {
		font-size: 14px;
		font-weight: 500;
		margin-bottom: 8px;
	}

	.description p {
		font-size: 14px;
		line-height: 1.6;
		white-space: pre-wrap;
	}

	.loading {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 400px;
		color: var(--text-secondary);
		font-size: 18px;
	}

	.error {
		display: flex;
		align-items: center;
		justify-content: center;
		min-height: 400px;
		color: var(--text-secondary);
		font-size: 18px;
	}

	@media (max-width: 1024px) {
		main.sidebar-open {
			margin-left: 0;
		}

		.watch-layout {
			flex-direction: column;
		}

		.secondary {
			width: 100%;
		}
	}

	@media (max-width: 768px) {
		.watch-layout {
			padding: 16px 12px;
			gap: 16px;
		}

		.player {
			border-radius: 8px;
		}

		h1 {
			font-size: 18px;
		}

		.video-meta {
			flex-direction: column;
			align-items: flex-start;
			gap: 12px;
		}

		.channel-info {
			width: 100%;
			flex-direction: column;
			align-items: flex-start;
		}

		.actions {
			width: 100%;
			flex-wrap: wrap;
		}

		.action-btn {
			flex: 1;
			justify-content: center;
			padding: 10px 12px;
			font-size: 14px;
		}

		.share-menu {
			min-width: 180px;
			right: 0;
		}

		.description {
			padding: 12px;
		}
	}

	@media (max-width: 480px) {
		.watch-layout {
			padding: 8px 0;
			gap: 12px;
		}

		.player {
			border-radius: 0;
		}

		h1 {
			font-size: 16px;
			padding: 0 12px;
		}

		.video-info {
			padding: 0 12px;
		}

		.video-meta {
			gap: 8px;
		}

		.channel img {
			width: 36px;
			height: 36px;
		}

		.channel h3 {
			font-size: 14px;
		}

		.action-btn {
			padding: 8px 10px;
			font-size: 13px;
			gap: 6px;
		}

		.description {
			margin: 0 12px;
			padding: 10px;
		}

		.stats {
			font-size: 13px;
		}

		.loading,
		.error {
			min-height: 250px;
			font-size: 14px;
		}
	}
</style>
