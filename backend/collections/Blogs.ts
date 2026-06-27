import type { CollectionConfig } from 'payload';

export const Blogs: CollectionConfig = {
  slug: 'blogs',
  admin: {
    useAsTitle: 'title',
    defaultColumns: ['title', 'category', 'updatedAt'],
  },
  fields: [
    {
      name: 'title',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      type: 'text',
      required: true,
      unique: true,
      index: true,
    },
    {
      name: 'description',
      type: 'textarea',
      required: true,
    },
    {
      name: 'category',
      type: 'select',
      required: true,
      options: [
        { label: 'Articles', value: 'Articles' },
        { label: 'Tutorials', value: 'Tutorials' },
        { label: 'AI & ML', value: 'AI & ML' },
        { label: 'Full Stack', value: 'Full Stack' },
        { label: 'Projects', value: 'Projects' },
        { label: 'Student Life', value: 'Student Life' },
        { label: 'Engineering Notes', value: 'Engineering Notes' },
      ],
    },
    {
      name: 'coverImage',
      type: 'upload',
      relationTo: 'media',
    },
    {
      name: 'content',
      type: 'richText',
      required: true,
    },
    {
      name: 'metaKeywords',
      type: 'array',
      fields: [
        {
          name: 'keyword',
          type: 'text',
        },
      ],
    },
  ],
};


export {};
