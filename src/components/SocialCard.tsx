'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { CivicObject, SocialComment } from '@/lib/schemas';
import { KIND_META } from '@/lib/kinds';
import type { Services } from '@/services/ports';

/**
 * A civic object with M04 social actions: like, comment, save and a
 * deep link back to its pin on the shared map (`/map?sel=<id>`).
 */
export function SocialCard({ object, services }: { object: CivicObject; services: Services }) {
  const [likes, setLikes] = useState<number | null>(null);
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<SocialComment[] | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const meta = KIND_META[object.kind];

  useEffect(() => {
    let live = true;
    Promise.all([services.social.likes(object.id), services.social.liked(), services.social.saved()])
      .then(([count, likedIds, savedIds]) => {
        if (!live) return;
        setLikes(count);
        setLiked(likedIds.includes(object.id));
        setSaved(savedIds.includes(object.id));
      })
      .catch(() => {
        if (live) setError('Could not load activity.');
      });
    return () => {
      live = false;
    };
  }, [object.id, services]);

  async function toggleLike() {
    setError(null);
    try {
      const count = liked ? await services.social.unreact(object.id) : await services.social.react(object.id);
      setLikes(count);
      setLiked(!liked);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not react.');
    }
  }

  async function toggleSave() {
    setError(null);
    try {
      setSaved(await services.social.toggleSave(object.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    }
  }

  async function toggleComments() {
    const open = !commentsOpen;
    setCommentsOpen(open);
    if (open && comments === null) {
      try {
        setComments(await services.social.comments(object.id));
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not load comments.');
      }
    }
  }

  async function addComment() {
    const text = draft.trim();
    if (!text) return;
    try {
      const comment = await services.social.addComment(object.id, text);
      setComments((cs) => [...(cs ?? []), comment]);
      setDraft('');
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add comment.');
    }
  }

  return (
    <article className="card" aria-label={`${meta.label}: ${object.title}`}>
      <span className="badge" style={{ borderColor: meta.color, color: meta.color }}>
        {meta.label}
      </span>{' '}
      <span className="muted">· {object.updatedAt}</span>
      <h3 style={{ margin: '8px 0 4px' }}>{object.title}</h3>
      <p className="muted">{object.summary}</p>

      <div className="pill-row" style={{ marginTop: 8 }}>
        <button
          type="button"
          className={`pill ${liked ? 'active' : ''}`}
          onClick={toggleLike}
          aria-pressed={liked}
          aria-label={liked ? `Unlike ${object.title}` : `Like ${object.title}`}
        >
          ♥ {likes ?? '…'}
        </button>
        <button type="button" className={`pill ${commentsOpen ? 'active' : ''}`} onClick={toggleComments} aria-expanded={commentsOpen}>
          💬 {comments ? `${comments.length} comment${comments.length === 1 ? '' : 's'}` : 'Comments'}
        </button>
        <button type="button" className={`pill ${saved ? 'active' : ''}`} onClick={toggleSave} aria-pressed={saved}>
          {saved ? '🔖 Saved' : '🔖 Save'}
        </button>
        <Link className="pill" href={`/map?sel=${object.id}`}>
          📍 View on map
        </Link>
      </div>

      {error && (
        <p role="alert" className="muted" style={{ marginTop: 8 }}>
          {error}
        </p>
      )}

      {commentsOpen && (
        <div style={{ marginTop: 12, borderTop: '1px solid var(--line)', paddingTop: 8 }}>
          {comments === null && <p className="muted">Loading comments…</p>}
          {comments?.map((c) => (
            <div key={c.id} style={{ marginBottom: 8 }}>
              <strong style={{ fontSize: 13 }}>{c.author}</strong>{' '}
              <span className="muted" style={{ fontSize: 12 }}>
                {c.createdAt}
              </span>
              <p style={{ margin: '2px 0 0', fontSize: 14 }}>{c.text}</p>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a comment…"
              maxLength={500}
              style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid var(--line)', fontSize: 13 }}
              aria-label={`Comment on ${object.title}`}
            />
            <button type="button" className="btn secondary" onClick={addComment}>
              Reply
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
