declare module '*.mdx' {
  import type { ComponentType } from 'react';
  import type { MDXProps } from 'mdx/types';

  const MDXContent: ComponentType<MDXProps>;
  export default MDXContent;
}

declare module '*.md' {
  import type { ComponentType } from 'react';
  import type { MDXProps } from 'mdx/types';

  const MarkdownContent: ComponentType<MDXProps>;
  export default MarkdownContent;
}
