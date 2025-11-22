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
      className="bg-white rounded-[28px] shadow-xl border border-slate-200 mb-3 overflow-hidden transition-shadow hover:shadow-2xl"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Media - Full Bleed at Top */}
      {task.images && task.images.length > 0 && (
        <div className="w-full aspect-[16/10] bg-gray-100 relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={task.images[0]}
            alt={task.title}
            className="w-full h-full object-cover block"
          />
          {/* Category badge overlay */}
          <div className="absolute top-3 left-3">
            <span className="bg-white/95 backdrop-blur-sm text-slate-900 px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
              {task.category}
            </span>
          </div>
        </div>
      )}

      {/* Content Section */}
      <div className="px-6 py-5 sm:px-8 sm:py-6">
        {/* Title & Description */}
        <div className="mb-4">
          <h3 className="text-xl font-bold text-slate-900 mb-2 leading-tight">{task.title}</h3>
          <p className="text-[15px] text-slate-600 line-clamp-3 leading-relaxed">{task.description}</p>
        </div>

        {/* Details Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {/* Budget */}
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-2xl p-3">
            <div className="flex items-center gap-1.5 text-emerald-700 mb-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-wider">Budget</span>
            </div>
            <div className="text-2xl font-bold text-emerald-900">₹{task.budget}</div>
          </div>

          {/* Location */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3">
            <div className="flex items-center gap-1.5 text-slate-600 mb-0.5">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-[10px] font-semibold uppercase tracking-wider">Location</span>
            </div>
            <div className="text-sm font-semibold text-slate-900 truncate">{task.location}</div>
          </div>
        </div>

        {/* Category badge (if no image) */}
        {(!task.images || task.images.length === 0) && (
          <div className="mb-4">
            <span className="bg-blue-50 text-blue-700 px-3 py-1.5 rounded-full text-xs font-semibold">
              {task.category}
            </span>
          </div>
        )}

        {/* Posted by */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <Link href={`/profile/${(task as any).poster_id}`} className="flex items-center gap-2.5 min-w-0 cursor-pointer group">
            <div className="h-9 w-9 rounded-full overflow-hidden bg-gray-100 ring-2 ring-slate-100 flex-shrink-0 group-hover:ring-slate-200 transition-all">
              {(task as any).poster?.avatar_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={(task as any).poster.avatar_url as string} alt={(task as any).poster.full_name as string} className="h-full w-full object-cover" />
              ) : (
                <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary text-sm font-bold">
                  {((task as any).poster?.full_name || 'U').charAt(0).toUpperCase()}
                </div>
              )}
            </div>
            <div className="min-w-0 flex flex-col">
              <span className="text-sm text-slate-900 font-semibold group-hover:underline truncate">
                {(task as any).poster?.full_name || 'Someone'}
              </span>
              <span className="text-xs text-slate-500">{formatDistanceToNow(new Date((task as any).created_at))} ago</span>
            </div>
          </Link>

          {canDelete && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting}
              className="text-gray-400 hover:text-red-500 hover:bg-red-50 p-2 rounded-full transition-colors"
              title="Delete post"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Footer actions */}
      <div className="px-3 py-2 border-t border-slate-200">
        <div className="flex items-center justify-between">
          <Link href={`/tasks/${task.id}`} className="flex-1 flex items-center justify-center gap-2 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-slate-600 font-semibold text-sm">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
            View details
          </Link>
          <button
            onClick={handleComment}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-slate-600 font-semibold text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
            </svg>
            Comment
          </button>
          <button
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 hover:bg-slate-50 rounded-xl transition-colors text-slate-600 font-semibold text-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            Share
          </button>
        </div>
      </div>

      {/* Inline comments */}
      {showComments && (
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="mt-2">
            {commentsLoading ? (
              <div className="text-xs text-gray-500">Loading comments…</div>
            ) : comments.length === 0 ? (
              <div className="text-xs text-gray-500">Be the first to comment.</div>
            ) : (
              <div className="space-y-3">
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
                      <div className="bg-white border border-gray-200 rounded-2xl px-3 py-2 inline-block max-w-full shadow-sm">
                        <div className="text-[13px] font-semibold text-gray-900">{c.user?.full_name || 'User'}</div>
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
                        <button onClick={() => toggleLike(c.id)} className={`font-semibold hover:underline ${likedByMe[c.id] ? 'text-primary' : ''}`}>Like</button>
                        <button className="font-semibold hover:underline" onClick={(e) => e.preventDefault()}>Reply</button>
                        <span>{formatDistanceToNow(new Date(c.created_at))}</span>
                        {typeof likeCounts[c.id] !== 'undefined' && likeCounts[c.id] > 0 && (
                          <span className="flex items-center gap-1">
                            <span className="bg-primary rounded-full p-0.5">
                              <svg className="w-2 h-2 text-white" fill="currentColor" viewBox="0 0 20 20"><path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" /></svg>
                            </span>
                            {likeCounts[c.id]}
                          </span>
                        )}
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

          <form onSubmit={handleAddComment} className="mt-3 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
              {/* Current user avatar placeholder */}
              <div className="h-full w-full flex items-center justify-center bg-gray-200 text-gray-500 text-xs">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
              </div>
            </div>
            <div className="flex-1 relative">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder="Write a comment…"
                className="w-full rounded-full border-none bg-gray-100 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200"
                disabled={postingComment}
              />
              <button
                type="submit"
                disabled={postingComment || !commentText.trim()}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-primary disabled:opacity-50"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}