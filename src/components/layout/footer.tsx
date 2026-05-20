export function Footer() {
  return (
    <footer className="shrink-0 border-t border-border bg-white px-6 py-3 text-center text-xs text-muted-foreground">
      © {new Date().getFullYear()} Kirby Corporation. All rights reserved.
      &nbsp;·&nbsp;
      <a
        href="https://www.kirbycorp.com/privacy-and-cookie-policy/"
        className="hover:text-k-navy underline-offset-2 hover:underline"
        target="_blank"
        rel="noopener noreferrer"
      >
        Privacy Policy
      </a>
    </footer>
  );
}
