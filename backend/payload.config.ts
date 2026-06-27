import { mongooseAdapter } from '@payloadcms/db-mongodb';
import { lexicalEditor } from '@payloadcms/richtext-lexical';
import { buildConfig } from 'payload';
import { Blogs } from './collections/Blogs';
import { Media } from './collections/Media';
import { Users } from './collections/Users';

export default buildConfig({
  admin: {
    user: Users.slug,
  },
  collections: [Users, Media, Blogs],
  editor: lexicalEditor({}),
  secret: process.env.PAYLOAD_SECRET || '',
  db: mongooseAdapter({
    url: process.env.MONGODB_URI || '',
  }),
  upload: {
    limits: {
      fileSize: 10 * 1024 * 1024,
    },
  },
});

export {};
