/** Internal routes stay in the hash so the exported file needs no server. */
export function artifactHref(href: string): string {
  return href.startsWith("/") && !href.startsWith("//") ? `#${href}` : href;
}

export function useRouter() {
  return {
    push(href: string) {
      window.location.hash = artifactHref(href);
    },
    replace(href: string) {
      const url = new URL(window.location.href);
      url.hash = artifactHref(href);
      window.history.replaceState(null, "", url);
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    },
    back() {
      window.history.back();
    },
    forward() {
      window.history.forward();
    },
    refresh() {
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    },
  };
}
