declare module 'payload' {
  export type CollectionConfig = any;
  export function buildConfig(config: any): any;
}

declare module '@payloadcms/db-mongodb' {
  export function mongooseAdapter(config: any): any;
}

declare module '@payloadcms/richtext-lexical' {
  export function lexicalEditor(config?: any): any;
}

declare module 'redis' {
  export function createClient(config?: any): any;
}

