import type { NextStepAction } from "../../src/types.js";

/** Impact (up) against effort (right). Each action is a numbered dot in its
 * cell; the quick-win corner (low effort, solid impact) is shaded. */
export default function ActionMatrix({
  actions,
  selected,
  onSelect,
}: {
  actions: NextStepAction[];
  selected: number | null;
  onSelect: (priority: number) => void;
}) {
  const levels = [5, 4, 3, 2, 1];
  const efforts = [1, 2, 3, 4, 5];

  return (
    <div className="matrix">
      <div className="matrix-y">Impact</div>
      <div className="matrix-grid">
        {levels.map((impact) =>
          efforts.map((effort) => {
            const here = actions.filter((a) => a.impact.score === impact && a.effort.score === effort);
            const quick = effort <= 2 && impact >= 3;
            return (
              <div key={`${impact}-${effort}`} className={`matrix-cell${quick ? " matrix-quick" : ""}`}>
                {here.map((a) => (
                  <button
                    key={a.priority}
                    className={`matrix-dot${selected === a.priority ? " matrix-dot-on" : ""}`}
                    title={`${a.priority}. ${a.title} (impact ${a.impact.score}, effort ${a.effort.score})`}
                    aria-label={`Action ${a.priority}: ${a.title}`}
                    onClick={() => onSelect(a.priority)}
                  >
                    {a.priority}
                  </button>
                ))}
              </div>
            );
          }),
        )}
      </div>
      <div className="matrix-yticks">
        {levels.map((l) => (
          <span key={l}>{l}</span>
        ))}
      </div>
      <div className="matrix-xticks">
        {efforts.map((e) => (
          <span key={e}>{e}</span>
        ))}
      </div>
      <div className="matrix-x">Effort →</div>
      <div className="matrix-note">Shaded corner: quick wins.</div>
    </div>
  );
}
