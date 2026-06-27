import type {
  Blog,
  GetBlogsResponse,
  GetCommentsResponse,
  AddCommentResponse,
  LikeCommentResponse,
  IncrementViewResponse,
  ReactToBlogResponse,
  AgentStatusResponse,
  NotificationResponse,
  HealthResponse,
} from './types';
import { buildApiUrl, buildWebSocketUrl } from './apiConfig';

export async function getBlogs(params?: {
  pageNumber?: number;
  pageSize?: number;
  keyword?: string;
  category?: string;
}): Promise<GetBlogsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.pageNumber) searchParams.set('pageNumber', params.pageNumber.toString());
  if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());
  if (params?.keyword) searchParams.set('keyword', params.keyword);
  if (params?.category && params.category !== 'All') {
    searchParams.set('category', params.category);
  }

  const res = await fetch(buildApiUrl('blogs', searchParams));
  if (!res.ok) throw new Error('Failed to fetch blogs');
  return res.json();
}

export async function getBlogBySlug(slug: string): Promise<Blog> {
  const res = await fetch(buildApiUrl(`blogs/slug/${encodeURIComponent(slug)}`));
  if (!res.ok) throw new Error('Failed to fetch blog');
  return res.json();
}

export async function getBlogById(id: string): Promise<Blog> {
  const res = await fetch(buildApiUrl(`blogs/${encodeURIComponent(id)}`));
  if (!res.ok) throw new Error('Failed to fetch blog');
  return res.json();
}

export async function getCommentsByBlog(
  idOrSlug: string,
  params?: {
    pageNumber?: number;
    pageSize?: number;
    status?: string;
  }
): Promise<GetCommentsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.pageNumber) searchParams.set('pageNumber', params.pageNumber.toString());
  if (params?.pageSize) searchParams.set('pageSize', params.pageSize.toString());
  if (params?.status) searchParams.set('status', params.status);

  const res = await fetch(
    buildApiUrl(`blogs/${encodeURIComponent(idOrSlug)}/comments`, searchParams)
  );
  if (!res.ok) throw new Error('Failed to fetch comments');
  return res.json();
}

export async function addComment(
  idOrSlug: string,
  name: string,
  content: string
): Promise<AddCommentResponse> {
  const res = await fetch(buildApiUrl(`blogs/${encodeURIComponent(idOrSlug)}/comments`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, content }),
  });
  if (!res.ok) throw new Error('Failed to add comment');
  return res.json();
}

export async function likeComment(
  idOrSlug: string,
  commentId: string
): Promise<LikeCommentResponse> {
  const res = await fetch(
    buildApiUrl(
      `blogs/${encodeURIComponent(idOrSlug)}/comments/${encodeURIComponent(commentId)}/like`
    ),
    {
      method: 'POST',
    }
  );
  if (!res.ok) throw new Error('Failed to like comment');
  return res.json();
}

export async function incrementView(slug: string): Promise<IncrementViewResponse> {
  const deviceInfo = getDeviceInfo();
  const res = await fetch(buildApiUrl(`blogs/${encodeURIComponent(slug)}/view`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(deviceInfo),
  });
  if (!res.ok) throw new Error('Failed to increment view');
  return res.json();
}

export async function reactToBlog(id: string): Promise<ReactToBlogResponse> {
  const res = await fetch(buildApiUrl(`blogs/${encodeURIComponent(id)}/react`), {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to react to blog');
  return res.json();
}

export async function getHealth(): Promise<HealthResponse> {
  const res = await fetch(buildApiUrl('health'));
  if (!res.ok) throw new Error('Failed to fetch health');
  return res.json();
}

export async function getAgentStatus(): Promise<AgentStatusResponse> {
  const res = await fetch(buildApiUrl('agent/status'));
  if (!res.ok) throw new Error('Failed to fetch agent status');
  return res.json();
}

export async function subscribeToNotifications(
  token: string,
  deviceType?: string
): Promise<NotificationResponse> {
  const res = await fetch(buildApiUrl('notifications/subscribe'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, deviceType }),
  });
  if (!res.ok) throw new Error('Failed to subscribe to notifications');
  return res.json();
}

export async function unsubscribeFromNotifications(token: string): Promise<NotificationResponse> {
  const res = await fetch(buildApiUrl('notifications/unsubscribe'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token }),
  });
  if (!res.ok) throw new Error('Failed to unsubscribe from notifications');
  return res.json();
}

export function getAgentWebSocketUrl() {
  return buildWebSocketUrl('/ws/agent', process.env.NEXT_PUBLIC_AGENT_WS_URL);
}

export function getViewWebSocketUrl(slug: string) {
  return buildWebSocketUrl(`/ws?slug=${encodeURIComponent(slug)}`);
}

function getDeviceInfo() {
  if (typeof window === 'undefined') return {};
  const ua = navigator.userAgent;
  let os = 'Unknown';
  let browser = 'Unknown';
  let type = 'desktop';

  if (/iPhone|iPad|iPod/.test(ua)) os = 'iOS';
  else if (/Android/.test(ua)) os = 'Android';
  else if (/Windows/.test(ua)) os = 'Windows';
  else if (/Mac/.test(ua)) os = 'macOS';
  else if (/Linux/.test(ua)) os = 'Linux';

  if (/Edg/.test(ua)) browser = 'Edge';
  else if (/OPR|Opera/.test(ua)) browser = 'Opera';
  else if (/Firefox/.test(ua)) browser = 'Firefox';
  else if (/Chrome/.test(ua)) browser = 'Chrome';
  else if (/Safari/.test(ua)) browser = 'Safari';

  if (/Mobile|Android|iPhone|iPad|iPod/.test(ua)) type = 'mobile';

  return {
    deviceType: type,
    deviceOs: os,
    deviceBrowser: browser,
  };
}
