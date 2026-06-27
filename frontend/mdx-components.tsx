import Link from 'next/link';
import type { ComponentPropsWithoutRef } from 'react';
import type { MDXComponents } from 'mdx/types';

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function MdxLink({ href, className, children, ...props }: ComponentPropsWithoutRef<'a'>) {
  const sharedClassName = cx(
    'font-semibold text-primary underline-offset-4 hover:underline',
    className
  );

  if (typeof href === 'string' && href.startsWith('/')) {
    return (
      <Link href={href} className={sharedClassName} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <a
      {...props}
      href={href}
      className={sharedClassName}
      target={props.target ?? '_blank'}
      rel={props.rel ?? 'noopener noreferrer'}
    >
      {children}
    </a>
  );
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    wrapper: ({ children }) => (
      <article className="prose mdx-content mx-auto w-full max-w-3xl px-4 py-12 text-slate-800 dark:text-slate-300 sm:px-6 lg:px-0">
        {children}
      </article>
    ),
    h1: ({ className, ...props }: ComponentPropsWithoutRef<'h1'>) => (
      <h1
        className={cx(
          'font-serif text-4xl font-bold leading-tight text-slate-950 dark:text-white md:text-5xl',
          className
        )}
        {...props}
      />
    ),
    h2: ({ className, ...props }: ComponentPropsWithoutRef<'h2'>) => (
      <h2
        className={cx(
          'mt-10 font-serif text-3xl font-bold leading-snug text-slate-950 dark:text-white',
          className
        )}
        {...props}
      />
    ),
    h3: ({ className, ...props }: ComponentPropsWithoutRef<'h3'>) => (
      <h3
        className={cx(
          'mt-8 font-serif text-2xl font-bold leading-snug text-slate-950 dark:text-white',
          className
        )}
        {...props}
      />
    ),
    p: ({ className, ...props }: ComponentPropsWithoutRef<'p'>) => (
      <p className={cx('leading-8 text-slate-700 dark:text-slate-300', className)} {...props} />
    ),
    a: MdxLink,
    blockquote: ({ className, ...props }: ComponentPropsWithoutRef<'blockquote'>) => (
      <blockquote
        className={cx(
          'border-l-4 border-primary bg-slate-50 px-5 py-4 font-serif italic text-slate-700 dark:bg-slate-900/70 dark:text-slate-300',
          className
        )}
        {...props}
      />
    ),
    ul: ({ className, ...props }: ComponentPropsWithoutRef<'ul'>) => (
      <ul className={cx('list-disc space-y-2 pl-6', className)} {...props} />
    ),
    ol: ({ className, ...props }: ComponentPropsWithoutRef<'ol'>) => (
      <ol className={cx('list-decimal space-y-2 pl-6', className)} {...props} />
    ),
    li: ({ className, ...props }: ComponentPropsWithoutRef<'li'>) => (
      <li className={cx('pl-1 leading-7', className)} {...props} />
    ),
    hr: ({ className, ...props }: ComponentPropsWithoutRef<'hr'>) => (
      <hr className={cx('my-10 border-slate-200 dark:border-slate-800', className)} {...props} />
    ),
    pre: ({ className, ...props }: ComponentPropsWithoutRef<'pre'>) => (
      <pre
        className={cx(
          'overflow-x-auto rounded-lg bg-slate-950 p-4 text-sm text-slate-100',
          className
        )}
        {...props}
      />
    ),
    code: ({ className, ...props }: ComponentPropsWithoutRef<'code'>) => (
      <code
        className={cx(
          'rounded bg-slate-100 px-1.5 py-0.5 text-sm text-slate-900 dark:bg-slate-800 dark:text-slate-100',
          className
        )}
        {...props}
      />
    ),
    table: ({ className, ...props }: ComponentPropsWithoutRef<'table'>) => (
      <div className="my-8 overflow-x-auto">
        <table className={cx('w-full border-collapse text-sm', className)} {...props} />
      </div>
    ),
    th: ({ className, ...props }: ComponentPropsWithoutRef<'th'>) => (
      <th
        className={cx(
          'border border-slate-200 bg-slate-100 px-3 py-2 text-left font-semibold dark:border-slate-800 dark:bg-slate-900',
          className
        )}
        {...props}
      />
    ),
    td: ({ className, ...props }: ComponentPropsWithoutRef<'td'>) => (
      <td className={cx('border border-slate-200 px-3 py-2 dark:border-slate-800', className)} {...props} />
    ),
    ...components,
  };
}
