import { SCI_WEBSITE_URL } from '../../config/branding';
import { pl } from '../../i18n/pl';
export function AppHeader() {
  return (
    <header>
      <div className="brand">
        <a
          className="brand-mark"
          href={SCI_WEBSITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={pl.sciWebsite}
        >
          SCI<span>_</span>
        </a>
        <span>
          {pl.brand}
          <small>{pl.school}</small>
        </span>
      </div>
      <div className="workshop-tag">{pl.workshop}</div>
    </header>
  );
}
