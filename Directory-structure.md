## 📁 Project Structure

```bash
Directory structure:
└── mdtaju0908-the-engineering-journal/
    ├── README.md
    ├── backend/
    │   ├── index.ts
    │   ├── package.json
    │   ├── payload.config.ts
    │   ├── tsconfig.json
    │   ├── agents/
    │   │   └── dailyBlogAgent.ts
    │   ├── collections/
    │   │   ├── Blogs.ts
    │   │   ├── Media.ts
    │   │   └── Users.ts
    │   ├── config/
    │   │   ├── cloudinary.ts
    │   │   ├── db.ts
    │   │   ├── firebaseAdmin.ts
    │   │   └── gemini.ts
    │   ├── controllers/
    │   │   ├── agentController.ts
    │   │   ├── blogController.ts
    │   │   ├── indexingController.ts
    │   │   └── notificationController.ts
    │   ├── cron/
    │   │   └── blogAgentCron.ts
    │   ├── events/
    │   │   └── agentEvents.ts
    │   ├── lib/
    │   │   └── redis.ts
    │   ├── middleware/
    │   │   └── authMiddleware.ts
    │   ├── models/
    │   │   ├── AgentLog.ts
    │   │   ├── AgentSettings.ts
    │   │   ├── AgentStatus.ts
    │   │   ├── Blog.ts
    │   │   ├── BlogView.ts
    │   │   ├── Comment.ts
    │   │   ├── NotificationToken.ts
    │   │   └── User.ts
    │   ├── realtime/
    │   │   ├── agentSocketHub.ts
    │   │   └── viewSocketHub.ts
    │   ├── routes/
    │   │   ├── agentRoutes.ts
    │   │   ├── blogRoutes.ts
    │   │   ├── configRoutes.ts
    │   │   └── notificationRoutes.ts
    │   ├── scripts/
    │   │   ├── runAgentOnce.ts
    │   │   └── ssg.ts
    │   ├── services/
    │   │   ├── blogGenerateService.ts
    │   │   ├── coverImageService.ts
    │   │   ├── newsSearchService.ts
    │   │   ├── notificationService.ts
    │   │   └── trendService.ts
    │   ├── types/
    │   │   └── external.d.ts
    │   └── utils/
    │       └── slugify.ts
    ├── frontend/
    │   ├── eslint.config.mjs
    │   ├── middleware.ts
    │   ├── next.config.ts
    │   ├── package.json
    │   ├── postcss.config.mjs
    │   ├── tailwind.config.ts
    │   ├── tsconfig.json
    │   ├── app/
    │   │   ├── globals.css
    │   │   ├── layout.tsx
    │   │   ├── (default)/
    │   │   │   ├── layout.tsx
    │   │   │   ├── page.tsx
    │   │   │   ├── robots.ts
    │   │   │   ├── sitemap.ts
    │   │   │   ├── [category]/
    │   │   │   │   └── page.tsx
    │   │   │   ├── about/
    │   │   │   │   └── page.tsx
    │   │   │   ├── feed.xml/
    │   │   │   │   └── route.ts
    │   │   │   └── newsletter/
    │   │   │       └── page.tsx
    │   │   └── [category]/
    │   │       └── (post)/
    │   │           ├── layout.tsx
    │   │           └── [slug]/
    │   │               └── page.tsx
    │   ├── components/
    │   │   ├── AgentWidget.tsx
    │   │   ├── BlogListPage.tsx
    │   │   ├── Footer.tsx
    │   │   └── Navbar.tsx
    │   ├── lib/
    │   │   ├── api.ts
    │   │   ├── apiConfig.ts
    │   │   ├── routes.ts
    │   │   ├── types.ts
    │   │   └── utils.ts
    │   └── public/
    │       ├── feed.xml
    │       ├── firebase-messaging-sw.js
    │       ├── firebase-messaging-sw.ts
    │       ├── ws-client.js
    │       └── ws-client.ts
    └── .agents/
        ├── AGENTS.md
        ├── CLAUDE.md
        └── Gemini.md
```