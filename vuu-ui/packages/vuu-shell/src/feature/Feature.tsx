import React, { Suspense, useEffect } from "react";
import { registerComponent } from "@finos/vuu-layout";
import { FeatureErrorBoundary } from "./FeatureErrorBoundary";
import { Loader } from "./Loader";
import { importCSS } from "./css-module-loader";

/**
 * Ensure we never lazy load the same component more than once
 */
const componentsMap = new Map<string, ReturnType<typeof React.lazy>>();
const useCachedFeature = (url: string) => {
  useEffect(
    () => () => {
      componentsMap.delete(url);
    },
    [url]
  );

  if (!componentsMap.has(url)) {
    componentsMap.set(
      url,
      React.lazy(() => import(/* @vite-ignore */ url))
    );
  }

  const lazyFeature = componentsMap.get(url);

  if (!lazyFeature) {
    throw Error(`Unable to load Lazy Feature at url ${url}`);
  } else {
    return lazyFeature;
  }
};

export interface FeatureProps<P extends object | undefined = any> {
  /**
    props that will be passed to the lazily loaded component.
   */
  ComponentProps?: P;
  css?: string;
  height?: number;
  title?: string;
  /** 
   The url of javascript bundle to lazily load. Bundle must provide a default export
   and that export must be a React component.
   */
  url: string;
  width?: number;
}

function RawFeature<Params extends object | undefined>({
  url,
  css,
  ComponentProps: params,
  ...props
}: FeatureProps<Params>) {
  // useEffect(() => {
  //   console.log("%cFeature mount", "color: green;");
  //   return () => {
  //     console.log("%cFeature unmount", "color:red;");
  //   };
  // }, []);

  if (css) {
    //   import(/* @vite-ignore */ css, { assert: { type: "css" } }).then(
    //     (cssModule) => {
    //       console.log("%cInject Styles", "color: blue;font-weight: bold");
    //       document.adoptedStyleSheets = [
    //         ...document.adoptedStyleSheets,
    //         cssModule.default,
    //       ];
    //     }
    //   );
    // Polyfill until cypress build supports import assertions
    // Note: already fully supported in esbuild and vite
    importCSS(css).then((styleSheet) => {
      document.adoptedStyleSheets = [
        ...document.adoptedStyleSheets,
        styleSheet,
      ];
    });
  }

  const LazyFeature = useCachedFeature(url);
  return (
    <FeatureErrorBoundary url={url}>
      <Suspense fallback={<Loader />}>
        <LazyFeature {...props} {...params} />
      </Suspense>
    </FeatureErrorBoundary>
  );
}

/**
  Feature is a wrapper around React Lazy Loading. It will load a component
  from the given url. That url must resolve to a javascript bundle with a
  single default export. That export must be a React component.
 */
export const Feature = React.memo(RawFeature);
Feature.displayName = "Feature";
registerComponent("Feature", Feature, "view");
