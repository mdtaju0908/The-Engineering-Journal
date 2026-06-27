export interface Blog {
  _id: string;
  title: string;
  slug: string;
  description: string;
  content: string;
  category: string;
  author: string;
  image: string;
  imageUrl: string;
  coverImage: string;
  videoUrl: string;
  youtubeUrl: string;
  imageSource: string;
  metaKeywords: string[];
  likes: number;
  views: number;
  createdAt: string;
  updatedAt: string;
}

export interface Comment {
  _id: string;
  blog?: string;
  name: string;
  content: string;
  likes: number;
  status: 'approved' | 'pending' | 'spam';
  createdAt: string;
  updatedAt: string;
}

export interface GetBlogsResponse {
  success: boolean;
  blogs: Blog[];
  pages: number;
}

export interface GetCommentsResponse {
  success: boolean;
  comments: Comment[];
  pageNumber: number;
  pages: number;
  total: number;
}

export interface AddCommentResponse {
  success: boolean;
  comment: Comment;
}

export interface LikeCommentResponse {
  success: boolean;
  commentId: string;
  likes: number;
}

export interface IncrementViewResponse {
  views: number;
  unique?: boolean;
  skipped?: string;
  deviceType?: string;
  deviceOs?: string;
  deviceBrowser?: string;
}

export interface ReactToBlogResponse {
  likes: number;
}

export interface HealthResponse {
  success: boolean;
  service: string;
}

export interface AgentBackendStatus {
  _id?: string;
  isRunning?: boolean;
  step?: string;
  topic?: string;
  lastTopic?: string | null;
  lastCoverUrl?: string | null;
  lastGeneratedAt?: string | null;
  nextRun?: string | null;
  nextRunAt?: string | null;
  lastImageGenerated?: boolean;
  lastBlogWritten?: boolean;
  lastPublished?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentSettings {
  _id?: string;
  enabled?: boolean;
  intervalHours?: number;
  lastRun?: string | null;
  nextRun?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface AgentLog {
  _id?: string;
  timestamp: string;
  type: 'info' | 'success' | 'error';
  message: string;
  topic?: string;
  step?: string;
  error?: string;
}

export interface AgentStatusResponse {
  success: boolean;
  status?: AgentBackendStatus;
  settings?: AgentSettings;
  logs?: AgentLog[];
  nextRun?: string | null;
}

export interface NotificationResponse {
  success?: boolean;
  message: string;
}
