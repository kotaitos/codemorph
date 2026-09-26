import { languageLabel, messages, type UiLocale } from "./i18n";
import { Icon } from "./icons";
import type { Detail, Related } from "./types";
import { languageColor } from "./visuals";

type Props = {
  detail: Detail;
  locale: UiLocale;
  side: "left" | "right";
  onClose: () => void;
  onSelect: (id: number) => void;
};

export function DetailPanel({
  detail,
  locale,
  side,
  onClose,
  onSelect,
}: Props) {
  const t = messages[locale];
  const formatter = new Intl.NumberFormat(locale);

  function relatedList(items: Related[], metric: "score" | "count" | null) {
    return items.length ? (
      <div className="chips">
        {items.map((item) => (
          <button key={item.id} type="button" onClick={() => onSelect(item.id)}>
            <span
              className="language-dot"
              style={{ backgroundColor: languageColor(item.language) }}
            />
            <span>{item.surface}</span>
            {metric && (
              <small>
                {metric === "score" ? item.score?.toFixed(2) : item.count}
              </small>
            )}
          </button>
        ))}
      </div>
    ) : (
      <p className="muted">{t.none}</p>
    );
  }

  return (
    <aside className={`detail-panel side-${side}`} aria-label={t.selected}>
      <div className="detail-header">
        <div>
          <p className="eyebrow">{t.selected}</p>
          <h2>{detail.token.surface}</h2>
        </div>
        <button
          type="button"
          className="icon-button close-detail"
          onClick={onClose}
          aria-label={t.clear}
          title={t.clear}
        >
          <Icon name="close" />
        </button>
      </div>
      <div className="detail-scroll" key={detail.token.id}>
        <div className="detail-metrics">
          <span className="detail-language">
            <span
              className="language-dot"
              style={{ backgroundColor: languageColor(detail.token.language) }}
            />
            {languageLabel(detail.token.language, locale)}
          </span>
          <div>
            <strong>{formatter.format(detail.token.frequency)}</strong>
            <span>{t.frequency}</span>
          </div>
          <div>
            <strong>{detail.token.tfidf.toFixed(2)}</strong>
            <span>{t.tfidf}</span>
          </div>
        </div>
        <section>
          <h3>{t.related}</h3>
          <p className="explanation">{t.similarityHint}</p>
          {relatedList(detail.similar, "score")}
        </section>
        <section>
          <h3>{t.variants}</h3>
          {relatedList(detail.variants, null)}
        </section>
        <section>
          <h3>{t.cooccurring}</h3>
          {relatedList(detail.cooccurring, "count")}
        </section>
        <section>
          <h3>{t.occurrences}</h3>
          <div className="occurrences">
            {detail.occurrences.map((item) => (
              <div className="occurrence" key={item.id}>
                <div className="file-path">
                  {item.path}:{item.line}
                </div>
                <p>{item.snippet}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
