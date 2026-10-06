import { AUTHOR_WEBSITE_URL } from '../../config/branding';
import { pl } from '../../i18n/pl';
export function AppFooter() {
  return (
    <footer className="app-copyright">
      <span>© 2026 </span>
      <a
        href={AUTHOR_WEBSITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={pl.authorWebsite}
      >
        DM
      </a>
    </footer>
  );
}
