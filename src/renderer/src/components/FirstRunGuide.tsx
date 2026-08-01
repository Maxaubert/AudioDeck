// The first-run guide: four cards explaining what AudioDeck is for.
//
// Shown once, on the first launch, and reachable again from Settings. It is a
// native <dialog> opened with showModal(), which gets the focus trap, the
// inert background and Escape-to-close from the platform rather than from
// hand-rolled key handlers that are usually subtly wrong.
//
// Only the active card is mounted, so each animation starts from its first
// frame when you arrive rather than mid-loop.

import { useEffect, useRef, useState } from "react";
import {
  RankAnimation,
  RowAnimation,
  StudioAnimation,
  TrayAnimation,
} from "./GuideAnimations.js";

interface Card {
  /** Short kicker above the heading, giving the card a place in the app. */
  where: string;
  title: string;
  body: string;
  art: () => React.JSX.Element;
}

const CARDS: Card[] = [
  {
    where: "Devices",
    title: "Rank your devices once",
    body:
      "AudioDeck sends your sound to the highest ranked device that is actually plugged in, and " +
      "falls back down the list the moment it is gone. Drag a row to change the order. Pick a " +
      "device by hand and that choice holds until something connects or disconnects.",
    art: RankAnimation,
  },
  {
    where: "Devices",
    title: "Every control on one row",
    body:
      "Volume, mute, the default flags, renaming and hiding all live on the device itself. There " +
      "is no separate mixer page to go and find, and no dialog to open to rename something.",
    art: RowAnimation,
  },
  {
    where: "Studio",
    title: "Tune any device you own",
    body:
      "A ten band equalizer plus bass, clarity, surround, reverb and volume boost, on any output " +
      "Windows can see. Each device keeps its own settings, so your headset and your speakers " +
      "never share a curve.",
    art: StudioAnimation,
  },
  {
    where: "Always",
    title: "Then it gets out of the way",
    body:
      "AudioDeck sits in the tray and keeps working while you play. It writes your custom names " +
      "back after a driver reset, forgets devices Windows has deleted, and can start when you " +
      "sign in.",
    art: TrayAnimation,
  },
];

export function FirstRunGuide({ onDismiss }: { onDismiss: () => void }) {
  const [step, setStep] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const primary = useRef<HTMLButtonElement>(null);
  const card = CARDS[step] as Card;
  const last = step === CARDS.length - 1;

  // showModal() rather than the open attribute: only the former makes the rest
  // of the page inert and gives the dialog the top layer.
  useEffect(() => {
    const el = dialog.current;
    if (el !== null && !el.open) el.showModal();
    // After showModal, not before: the dialog runs its own focusing steps on
    // open and would otherwise land on Skip, the one action nobody opening
    // this wants first. React drops the autofocus attribute, so asking for it
    // declaratively does not survive.
    primary.current?.focus();
  }, []);

  const Art = card.art;
  return (
    <dialog
      ref={dialog}
      className="guide"
      aria-labelledby="guide-title"
      // Escape closes a modal dialog natively, and it should count as "seen":
      // making someone reach the last card before the guide stops appearing
      // would be a worse deal than reading it.
      onClose={onDismiss}
      onCancel={onDismiss}
    >
      <div className="guide-card" key={step}>
        <div className="guide-art">
          <Art />
        </div>
        <div className="guide-copy" aria-live="polite">
          <p className="guide-where">{card.where}</p>
          <h2 className="guide-title" id="guide-title">
            {card.title}
          </h2>
          <p className="guide-body">{card.body}</p>
        </div>
      </div>

      <div className="guide-foot">
        {/* Hidden on the last card rather than removed: the primary button
            there already closes, and two buttons doing the same thing side by
            side is a choice that is not one. visibility keeps the width, so
            the dots do not slide sideways, and still takes it out of the tab
            order and the accessibility tree. */}
        <button
          type="button"
          className={last ? "btn guide-skip is-gone" : "btn guide-skip"}
          onClick={() => dialog.current?.close()}
        >
          Skip
        </button>

        <ol className="guide-dots">
          {CARDS.map((c, i) => (
            <li key={c.title}>
              <button
                type="button"
                className={i === step ? "guide-dot is-on" : "guide-dot"}
                aria-label={`Card ${i + 1} of ${CARDS.length}: ${c.title}`}
                aria-current={i === step}
                onClick={() => setStep(i)}
              />
            </li>
          ))}
        </ol>

        <div className="guide-nav">
          <button
            type="button"
            className="btn"
            disabled={step === 0}
            onClick={() => setStep((s) => s - 1)}
          >
            Back
          </button>
          <button
            type="button"
            ref={primary}
            className="btn btn-accent"
            onClick={() => (last ? dialog.current?.close() : setStep((s) => s + 1))}
          >
            {last ? "Get started" : "Next"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
