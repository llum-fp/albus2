import { Download, Headphones, X } from "./icons";

/* Audio overview player. A small modal with the generated two-host podcast: an
   <audio> element with native controls, the episode title, and a download link.
   Shared by the admin courses panel (preview) and the learner course viewer. */
export default function PodcastPlayer({
  audioUrl,
  title,
  onClose,
}: {
  audioUrl: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="podcast-overlay" role="dialog" aria-modal="true" onClick={onClose}>
      <div className="podcast-card" onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn podcast-close" onClick={onClose} title="Close">
          <X size={18} />
        </button>

        <div className="podcast-head">
          <span className="podcast-mark">
            <Headphones size={22} />
          </span>
          <div>
            <h3 className="podcast-title">{title}</h3>
            <p className="podcast-sub">Two-host deep dive · AI audio overview</p>
          </div>
        </div>

        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <audio className="podcast-audio" src={audioUrl} controls autoPlay preload="auto" />

        <div className="podcast-actions">
          <a className="btn btn-secondary" href={audioUrl} download>
            <Download size={16} /> Download
          </a>
        </div>
      </div>
    </div>
  );
}
