"use client";

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Task } from '@/lib/supabase';
import { formatDistanceToNow } from '@/utils/dateUtils';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface TaskCardProps {
  task: Task;
}

export default function TaskCard({ task }: TaskCardProps) {
  const router = useRouter();
  const [isHovered, setIsHovered] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [postingComment, setPostingComment] = useState(false);
  const [editCommentId, setEditCommentId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});
  const [likedByMe, setLikedByMe] = useState<Record<string, boolean>>({});
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>({});
  const supabase = createClientComponentClient();

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setUserId(session?.user?.id ?? null);
    })();
  }, [supabase]);

  const canDelete = userId && (task as any)?.poster_id === userId;

  const handleDelete = async () => {
    if (!canDelete || deleting) return;
    const ok = window.confirm('Delete this task? This action cannot be undone.');
    if (!ok) return;
    setDeleting(true);
    const urls: string[] = Array.isArray((task as any).images) ? ((task as any).images as string[]) : [];
    const marker = '/object/public/task_images/';
    const paths = urls
      .map((u) => {
        const idx = typeof u === 'string' ? u.indexOf(marker) : -1;
        return idx >= 0 ? u.slice(idx + marker.length) : null;
      })
      .filter((p): p is string => !!p);

    if (paths.length > 0) {
      await supabase.storage.from('task_images').remove(paths);
    }

    const { error } = await supabase.from('tasks').delete().eq('id', (task as any).id);
    if (error) {
      alert(error.message || 'Failed to delete task');
    }
    setDeleting(false);
    if (!error) {
      setHidden(true);
    }
  };

  const fetchComments = async () => {
    setCommentsLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('comments')
        .select('*')
        .eq('task_id', (task as any).id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      const list = rows || [];
      const userIds = Array.from(new Set(list.map((c: any) => c.user_id).filter(Boolean)));
      let profilesById: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from('profiles')
          .select('user_id, full_name, avatar_url')
          .in('user_id', userIds as string[]);
        if (profs) {
          for (const p of profs) profilesById[p.user_id] = p;
        }
      }
      const enriched = list.map((c: any) => ({
        ...c,
        user: profilesById[c.user_id] || null,
      }));
      setComments(enriched);
      await loadEngagement(enriched);
    } catch (e) {
      console.error('Failed to load comments', e);
    } finally {
      setCommentsLoading(false);
    }
  };

  const handleComment = async () => {
    const next = !showComments;
    setShowComments(next);
    if (next && comments.length === 0 && !commentsLoading) {
      await fetchComments();
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = commentText.trim();
    if (!text) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.push('/auth');
        return;
      }
      setPostingComment(true);
      const { data, error } = await supabase
        .from('comments')
        .insert({
          task_id: (task as any).id,
          user_id: session.user.id,
          content: text,
        })
        .select('*')
        .single();
      if (error) throw error;
      let user: any = null;
      const { data: prof } = await supabase
        .from('profiles')
        .select('user_id, full_name, avatar_url')
        .eq('user_id', session.user.id)
        .maybeSingle();
      if (prof) user = prof;
      setComments((prev) => [...prev, { ...data, user }]);
      setCommentText('');
      // Initialize like/reply counts for the new comment
      setLikeCounts((prev) => ({ ...prev, [data.id]: 0 }));
      setReplyCounts((prev) => ({ ...prev, [data.id]: 0 }));
      setLikedByMe((prev) => ({ ...prev, [data.id]: false }));
    } catch (e) {
      alert('Failed to post comment');
    } finally {
      setPostingComment(false);
    }
  };

  const loadEngagement = async (list: any[]) => {
    try {
      const ids = list.map((c) => c.id);
      // liked by me map
      if (userId && ids.length > 0) {
        const { data: myLikes } = await supabase
          .from('comment_likes')
          .select('comment_id')
          .eq('user_id', userId)
          .in('comment_id', ids);
        const likedMap: Record<string, boolean> = {};
        (myLikes || []).forEach((r: any) => (likedMap[r.comment_id] = true));
        setLikedByMe((prev) => ({ ...prev, ...likedMap }));
      }
      // like counts (do per id head count)
      const counts: Record<string, number> = {};
      for (const id of ids) {
        const { count } = await supabase
          .from('comment_likes')
          .select('*', { count: 'exact', head: true })
          .eq('comment_id', id);
        counts[id] = count ?? 0;
      }
      setLikeCounts((prev) => ({ ...prev, ...counts }));
      // reply counts (if table exists)
      const rCounts: Record<string, number> = {};
      for (const id of ids) {
        try {
          const { count } = await supabase
            .from('comment_replies')
            .select('*', { count: 'exact', head: true })
            .eq('comment_id', id);
          rCounts[id] = count ?? 0;
        } catch {
          rCounts[id] = 0;
        }
      }
      setReplyCounts((prev) => ({ ...prev, ...rCounts }));
    } catch {
      // ignore engagement load errors
    }
  };

  const toggleLike = async (commentId: string) => {
    if (!userId) {
      router.push('/auth');
      return;
    }
    const hasLiked = !!likedByMe[commentId];
    try {
      if (hasLiked) {
        const { error } = await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', userId);
        if (error) throw error;
        setLikedByMe((m) => ({ ...m, [commentId]: false }));
        setLikeCounts((c) => ({ ...c, [commentId]: Math.max(0, (c[commentId] || 0) - 1) }));
      } else {
        const { error } = await supabase
          .from('comment_likes')
          .insert({ comment_id: commentId, user_id: userId });
        if (error) throw error;
        setLikedByMe((m) => ({ ...m, [commentId]: true }));
        setLikeCounts((c) => ({ ...c, [commentId]: (c[commentId] || 0) + 1 }));
      }
    } catch {
      alert('Unable to update like');
    }
  };

  const startEdit = (c: any) => {
    setEditCommentId(c.id);
    setEditText(c.content);
  };

  const cancelEdit = () => {
    setEditCommentId(null);
    setEditText('');
  };

  const saveEdit = async (commentId: string) => {
    const text = editText.trim();
    if (!text) return;
    try {
      const { error } = await supabase
        .from('comments')
        .update({ content: text })
        .eq('id', commentId)
        .eq('user_id', userId!);
      if (error) throw error;
      setComments((prev) => prev.map((c) => (c.id === commentId ? { ...c, content: text } : c)));
      cancelEdit();
    } catch {
      alert('Failed to update comment');
    }
  };

  const deleteComment = async (commentId: string) => {
    const ok = window.confirm('Delete this comment?');
    if (!ok) return;
    try {
      const { error } = await supabase
        .from('comments')
        .delete()
        .eq('id', commentId)
        .eq('user_id', userId!);
      if (error) throw error;
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch {
      alert('Failed to delete comment');
    }
  };

  // Real-time comments subscription for this task
  useEffect(() => {
    if (!showComments) return;
    const channel = supabase
      .channel(`comments-${(task as any).id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'comments' }, (payload: any) => {
        if (payload?.new?.task_id !== (task as any).id) return;
        (async () => {
          let user: any = null;
          if (payload.new.user_id) {
            const { data: prof } = await supabase
              .from('profiles')
              .select('user_id, full_name, avatar_url')
              .eq('user_id', payload.new.user_id)
              .maybeSingle();
            user = prof || null;
          }
          setComments((prev) => [...prev, { ...payload.new, user }]);
          setLikeCounts((prev) => ({ ...prev, [payload.new.id]: 0 }));
          setReplyCounts((prev) => ({ ...prev, [payload.new.id]: 0 }));
        })();
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'comments' }, (payload: any) => {
        if (payload?.new?.task_id !== (task as any).id) return;
        setComments((prev) => prev.map((c) => (c.id === payload.new.id ? { ...c, ...payload.new } : c)));
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'comments' }, (payload: any) => {
        if (payload?.old?.task_id !== (task as any).id) return;
        setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [showComments, supabase, task]);

  const handleShare = async () => {
    try {
      const url = `${window.location.origin}/tasks/${task.id}`;
      if (navigator.share) {
        await navigator.share({
          title: task.title,
          text: task.description,
          url,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        alert('Link copied to clipboard');
      } else {
        const input = document.createElement('input');
        input.value = url;
        document.body.appendChild(input);
        input.select();
        document.execCommand('copy');
        document.body.removeChild(input);
        alert('Link copied');
      }
    } catch (_) {
      alert('Unable to share right now');
    }
  };

  if (hidden) return null;

  return (
    <div 
      className="bg-white rounded-lg border border-gray-200 overflow-hidden md:rounded-md md:border-0 md:bg-[rgb(var(--color-card))] md:shadow-sm md:hover:shadow-md md:transition-shadow"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Link href={`/profile/${(task as any).poster_id}`} className="flex items-center gap-2 min-w-0 cursor-pointer">
              <div className="h-10 w-10 rounded-full overflow-hidden bg-gray-100 ring-1 ring-gray-200 flex-shrink-0">
                {(task as any).poster?.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={(task as any).poster.avatar_url as string} alt={(task as any).poster.full_name as string} className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary text-sm font-bold">
                    {((task as any).poster?.full_name || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <div className="text-sm text-gray-900 font-medium truncate">{(task as any).poster?.full_name || 'Someone'}</div>
                <div className="text-[12px] text-gray-500 truncate">{formatDistanceToNow(new Date((task as any).created_at))}</div>
              </div>
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-primary/10 text-primary px-2 py-1 rounded-full text-xs font-medium whitespace-nowrap">
              {task.budget} money
            </span>
            {canDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="btn-secondary-compact border-red-300 text-red-700 hover:bg-red-50"
              >
                {deleting ? 'Deleting…' : 'Delete'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body: text first */}
      <div className="px-4 pb-3">
        <h3 className="text-base font-semibold text-gray-900 mb-1">{task.title}</h3>
        <p className="text-gray-700 text-sm whitespace-pre-line">{task.description}</p>
      </div>

      {/* Media */}
      {task.images && task.images.length > 0 && (
        <div className="tile w-full bg-black/5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={task.images[0]}
            alt={task.title}
            className={`w-full max-h-96 object-cover ${isHovered ? 'brightness-95' : 'brightness-100'}`}
          />
        </div>
      )}

      {/* Meta */}
      <div className="px-4 py-3 flex items-center justify-between text-xs text-gray-600">
        <div className="flex items-center truncate">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="truncate">{task.location}</span>
        </div>
        <span className="inline-flex items-center px-2 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-800">
          {task.category}
        </span>
      </div>

      {/* Footer actions */}
      <div className="px-2 py-1 grid grid-cols-3 gap-1">
        <Link href={`/tasks/${task.id}`} className="btn-subtle w-full text-center">
          View details
        </Link>
        <button type="button" onClick={handleComment} className="btn-subtle w-full text-center">
          Comment
        </button>
        <button type="button" onClick={handleShare} className="btn-subtle w-full text-center">
          Share
        </button>
      </div>

      {/* Inline comments */}
      {showComments && (
        <div className="px-3 pb-3">
          <div className="mt-2">
            {commentsLoading ? (
              <div className="text-xs text-gray-500">Loading comments…</div>
            ) : comments.length === 0 ? (
              <div className="text-xs text-gray-500">Be the first to comment.</div>
            ) : (
              <div className="space-y-2">
                {comments.map((c) => (
                  <div key={c.id} className="flex items-start gap-2">
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-100 ring-1 ring-gray-200 flex-shrink-0">
                      {c.user?.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={c.user.avatar_url} alt={c.user.full_name} className="h-full w-full object-cover" />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary text-xs font-bold">
                          {(c.user?.full_name || 'U').charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="bg-gray-100 rounded-2xl px-3 py-2 inline-block max-w-full sm:max-w-[90%] break-words">
                        <div className="text-[13px] font-medium text-gray-900">{c.user?.full_name || 'User'}</div>
                        {editCommentId === c.id ? (
                          <div className="mt-1">
                            <textarea
                              className="w-full text-[13px] rounded-md border border-gray-300 bg-white px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary"
                              rows={2}
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                            />
                            <div className="mt-1 flex gap-2 text-xs">
                              <button onClick={() => saveEdit(c.id)} className="px-2 py-1 bg-primary text-white rounded-md">Save</button>
                              <button onClick={cancelEdit} className="px-2 py-1 bg-gray-200 rounded-md">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-[13px] text-gray-800 whitespace-pre-wrap break-words">{c.content}</div>
                        )}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 gap-y-1 text-[12px] text-gray-500 pl-2">
                        <button onClick={() => toggleLike(c.id)} className={`hover:underline ${likedByMe[c.id] ? 'text-primary' : ''}`}>Like</button>
                        <button className="hover:underline" onClick={(e) => e.preventDefault()}>Reply</button>
                        <span>· {formatDistanceToNow(new Date(c.created_at))}</span>
                        {typeof likeCounts[c.id] !== 'undefined' && <span>· {likeCounts[c.id]} likes</span>}
                        {typeof replyCounts[c.id] !== 'undefined' && <span>· {replyCounts[c.id]} replies</span>}
                        {userId && c.user_id === userId && editCommentId !== c.id && (
                          <>
                            <span>·</span>
                            <button onClick={() => startEdit(c)} className="hover:underline">Edit</button>
                            <span>·</span>
                            <button onClick={() => deleteComment(c.id)} className="hover:underline">Delete</button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <form onSubmit={handleAddComment} className="mt-2 flex items-center gap-2">
            <input
              type="text"
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="Write a comment…"
              className="flex-1 rounded-full border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
              disabled={postingComment}
            />
            <button
              type="submit"
              disabled={postingComment}
              className="px-3 py-1.5 rounded-full bg-primary text-white text-sm disabled:opacity-60"
            >
              {postingComment ? 'Posting…' : 'Post'}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}