declare module "next" {
  export type Metadata = any;
}

declare module "next/navigation" {
  export function redirect(url: string): never;
  export function notFound(): never;
  export function useParams<T = Record<string, string | string[]>>(): T;
}

declare module "next/link" {
  import * as React from "react";

  const Link: React.ComponentType<any>;
  export default Link;
}

declare module "next/image" {
  import * as React from "react";

  const Image: React.ComponentType<any>;
  export default Image;
}

declare module "next/font/google" {
  export function Geist(options: any): any;
  export function Geist_Mono(options: any): any;
}

