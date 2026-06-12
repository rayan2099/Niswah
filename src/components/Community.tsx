/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Heart,
  MessageSquare,
  Plus,
  Search,
  Send,
  Shield,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useTranslation } from '../i18n/LanguageContext.tsx';
import { useCycleData } from '../contexts/CycleContext.tsx';
import {
  addCommunityComment,
  createCommunityPost,
  getCommunityPosts,
  toggleCommunityPostLike,
} from '../api/index.ts';
import { DBCommunityPost } from '../api/db-types.ts';
import { getAuthUser } from '../auth.ts';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatRelativeTime = (dateValue: string, isRTL: boolean) => {
  const date = new Date(dateValue);
  const diffMinutes = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000));
  if (diffMinutes < 1) return isRTL ? 'الآن' : 'Now';
  if (diffMinutes < 60) return isRTL ? `قبل ${diffMinutes} د` : `${diffMinutes}m ago`;
  const hours = Math.floor(diffMinutes / 60);
  if (hours < 24) return isRTL ? `قبل ${hours} س` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return isRTL ? `قبل ${days} يوم` : `${days}d ago`;
};

const seedPosts = (isRTL: boolean): DBCommunityPost[] => [
  {
    id: 'seed-privacy',
    author_id: 'seed',
    author_name: isRTL ? 'فريق نسوة' : 'Niswah Team',
    category: 'general',
    content: isRTL
      ? 'مساحة المجتمع للتجارب العامة والدعم الهادئ. تجنبي مشاركة الاسم الكامل، رقم الهاتف، أو أي تفاصيل تكشف هويتك.'
      : 'A calm community space for lived experience and support. Avoid sharing your full name, phone number, or details that reveal your identity.',
    is_anonymous: false,
    like_user_ids: [],
    comments: [],
    created_at: new Date(Date.now() - 60 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 60 * 60000).toISOString(),
  },
  {
    id: 'seed-fiqh',
    author_id: 'seed',
    author_name: isRTL ? 'تنبيه فقهي' : 'Fiqh note',
    category: 'fiqh',
    content: isRTL
      ? 'الأسئلة الفقهية الحساسة يُفضّل عرضها بصيغة عامة. المجتمع للمساندة، وليس بديلاً عن سؤال أهل العلم عند الحاجة.'
      : 'Sensitive fiqh questions are best shared generally. Community support does not replace asking qualified scholars when needed.',
    is_anonymous: false,
    like_user_ids: [],
    comments: [],
    created_at: new Date(Date.now() - 4 * 60 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 4 * 60 * 60000).toISOString(),
  },
];

export const Community = () => {
  const { t, isRTL } = useTranslation();
  const { user } = useCycleData();
  const [authUserId, setAuthUserId] = useState('');
  const [posts, setPosts] = useState<DBCommunityPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState<DBCommunityPost['category']>('general');
  const [isAnonymous, setIsAnonymous] = useState(Boolean(user?.anonymous_mode));
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [savingPost, setSavingPost] = useState(false);

  const categories = useMemo(() => [
    { id: 'all', label: t('category_all') },
    { id: 'general', label: isRTL ? 'عام' : 'General' },
    { id: 'health', label: t('category_health') },
    { id: 'fiqh', label: t('category_fiqh') },
    { id: 'mental', label: t('category_mental') },
  ], [isRTL, t]);

  useEffect(() => {
    let mounted = true;
    const loadPosts = async () => {
      setLoading(true);
      setSaveError('');
      const authUser = await getAuthUser();
      if (mounted) setAuthUserId(authUser?.id || '');
      const { data, error } = await getCommunityPosts();
      if (!mounted) return;
      if (error) {
        setSaveError(isRTL ? 'تعذر تحميل المجتمع. حاولي مرة أخرى.' : 'Could not load the community. Please try again.');
        setPosts([]);
      } else {
        setPosts(data || []);
      }
      setLoading(false);
    };

    loadPosts();
    return () => {
      mounted = false;
    };
  }, [isRTL]);

  const visiblePosts = posts.length ? posts : seedPosts(isRTL);
  const filteredPosts = visiblePosts.filter(post => {
    const matchesCategory = activeCategory === 'all' || post.category === activeCategory;
    const query = searchQuery.trim().toLowerCase();
    const matchesSearch = !query
      || post.content.toLowerCase().includes(query)
      || (post.author_name || '').toLowerCase().includes(query);
    return matchesCategory && matchesSearch;
  });

  const updatePostInList = (updatedPost: DBCommunityPost) => {
    setPosts(current => current.map(post => post.id === updatedPost.id ? updatedPost : post));
  };

  const handleCreatePost = async () => {
    const content = newPostContent.trim();
    if (!content || savingPost) return;
    setSavingPost(true);
    setSaveError('');

    const { data, error } = await createCommunityPost({
      content,
      category: newPostCategory,
      is_anonymous: isAnonymous,
    });

    if (error || !data) {
      const details = error ? ` (${error})` : '';
      setSaveError(
        isRTL
          ? `تعذر نشر المشاركة. تحققي من اتصالك وحاولي مرة أخرى.${details}`
          : `Could not publish the post. Please check your connection and try again.${details}`
      );
    } else {
      setPosts(current => [data, ...current]);
      setNewPostContent('');
      setNewPostCategory('general');
      setIsCreating(false);
      setIsAnonymous(Boolean(user?.anonymous_mode));
    }
    setSavingPost(false);
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] pb-32" dir={isRTL ? 'rtl' : 'ltr'}>
      <header className="sticky top-0 z-20 border-b border-rose-100/70 bg-[#FDFCFB]/95 px-4 pb-4 pt-8 backdrop-blur-xl sm:px-6">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1 text-right">
              <span className="text-[11px] font-bold text-rose-400">{isRTL ? 'مساحة آمنة' : 'Safe space'}</span>
              <h1 className="text-3xl font-serif font-bold text-rose-900">{t('community')}</h1>
              <p className="max-w-md text-xs leading-6 text-slate-500">
                {isRTL
                  ? 'شاركي سؤالاً أو تجربة بدون كشف هويتك. المحتوى هنا للدعم، وليس بديلاً عن الطبيب أو المفتي.'
                  : 'Share a question or experience without revealing your identity. Support here does not replace medical or fiqh care.'}
              </p>
            </div>
            <button
              onClick={() => setIsCreating(true)}
              className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-200 transition active:scale-95"
              aria-label={t('create_post')}
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>

          <div className="relative">
            <Search className={cn("absolute top-1/2 h-4 w-4 -translate-y-1/2 text-rose-300", isRTL ? "right-4" : "left-4")} />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={t('search')}
              className={cn(
                "h-12 w-full rounded-2xl border border-rose-100 bg-white text-sm text-rose-950 outline-none transition focus:border-rose-300 focus:ring-4 focus:ring-rose-100",
                isRTL ? "pr-11 pl-4 text-right" : "pl-11 pr-4 text-left"
              )}
            />
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={cn(
                  "shrink-0 rounded-full px-4 py-2 text-xs font-bold transition",
                  activeCategory === category.id
                    ? "bg-rose-600 text-white shadow-md shadow-rose-100"
                    : "bg-white text-rose-500 ring-1 ring-rose-100"
                )}
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-4 px-4 py-5 sm:px-6">
        {saveError && (
          <div className="rounded-3xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {saveError}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map(item => (
              <div key={item} className="h-44 animate-pulse rounded-[32px] bg-white ring-1 ring-rose-50" />
            ))}
          </div>
        ) : filteredPosts.length > 0 ? (
          filteredPosts.map(post => (
            <PostCard
              key={post.id}
              post={post}
              authUserId={authUserId}
              isSeed={post.author_id === 'seed'}
              onPostUpdated={updatePostInList}
            />
          ))
        ) : (
          <div className="rounded-[32px] bg-white p-10 text-center ring-1 ring-rose-100">
            <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-400">
              <MessageSquare className="h-7 w-7" />
            </div>
            <p className="text-sm font-bold text-rose-900">{t('no_results')}</p>
          </div>
        )}
      </main>

      <AnimatePresence>
        {isCreating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] flex items-end justify-center bg-slate-950/40 p-3 backdrop-blur-sm sm:items-center"
          >
            <motion.div
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              className="w-full max-w-lg overflow-hidden rounded-[32px] bg-white shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-rose-50 p-5">
                <button onClick={() => setIsCreating(false)} className="grid h-10 w-10 place-items-center rounded-2xl bg-slate-50 text-slate-400">
                  <X className="h-5 w-5" />
                </button>
                <div className="text-right">
                  <h3 className="text-lg font-serif font-bold text-rose-900">{t('create_post')}</h3>
                  <p className="text-xs text-slate-400">{isRTL ? 'اكتبي باحترام وبدون معلومات شخصية' : 'Write kindly and avoid personal details'}</p>
                </div>
              </div>

              <div className="space-y-5 p-5">
                <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                  {categories.filter(category => category.id !== 'all').map(category => (
                    <button
                      key={category.id}
                      onClick={() => setNewPostCategory(category.id as DBCommunityPost['category'])}
                      className={cn(
                        "shrink-0 rounded-2xl px-4 py-2 text-xs font-bold ring-1 transition",
                        newPostCategory === category.id
                          ? "bg-rose-600 text-white ring-rose-600"
                          : "bg-white text-slate-500 ring-slate-100"
                      )}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>

                <textarea
                  autoFocus
                  value={newPostContent}
                  onChange={(event) => setNewPostContent(event.target.value)}
                  placeholder={t('post_placeholder')}
                  maxLength={1200}
                  className="h-40 w-full resize-none rounded-3xl border border-rose-100 bg-rose-50/40 p-4 text-right text-base leading-8 text-rose-950 outline-none focus:border-rose-300"
                />

                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
                    <button
                      type="button"
                      onClick={() => setIsAnonymous(value => !value)}
                      className={cn(
                        "relative h-8 w-14 rounded-full transition",
                        isAnonymous ? "bg-rose-600" : "bg-slate-200"
                      )}
                    >
                      <span className={cn(
                        "absolute top-1 h-6 w-6 rounded-full bg-white shadow transition",
                        isAnonymous ? (isRTL ? "right-7" : "left-7") : (isRTL ? "right-1" : "left-1")
                      )} />
                    </button>
                    {t('post_anonymous')}
                  </label>

                  <button
                    onClick={handleCreatePost}
                    disabled={!newPostContent.trim() || savingPost}
                    className="rounded-2xl bg-rose-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-rose-100 transition disabled:bg-slate-100 disabled:text-slate-300"
                  >
                    {savingPost ? (isRTL ? 'جارٍ النشر...' : 'Posting...') : t('post_button')}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const PostCard = ({
  post,
  authUserId,
  isSeed,
  onPostUpdated,
}: {
  post: DBCommunityPost;
  authUserId: string;
  isSeed: boolean;
  onPostUpdated: (post: DBCommunityPost) => void;
}) => {
  const { t, isRTL } = useTranslation();
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const liked = Boolean(authUserId && post.like_user_ids?.includes(authUserId));
  const authorName = post.is_anonymous ? t('guest_user') : (post.author_name || t('guest_user'));

  const handleLike = async () => {
    if (isSeed || busy) return;
    setBusy(true);
    setError('');
    const { data, error: apiError } = await toggleCommunityPostLike(post);
    if (apiError || !data) {
      setError(isRTL ? 'تعذر حفظ الإعجاب.' : 'Could not save like.');
    } else {
      onPostUpdated(data);
    }
    setBusy(false);
  };

  const handleComment = async () => {
    const content = commentText.trim();
    if (!content || isSeed || busy) return;
    setBusy(true);
    setError('');
    const { data, error: apiError } = await addCommunityComment(post, content);
    if (apiError || !data) {
      setError(isRTL ? 'تعذر إضافة التعليق.' : 'Could not add comment.');
    } else {
      onPostUpdated(data);
      setCommentText('');
      setShowComments(true);
    }
    setBusy(false);
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="space-y-4 rounded-[32px] bg-white p-5 shadow-sm ring-1 ring-rose-100/80"
    >
      <div className={cn("flex items-start gap-3", isRTL ? "flex-row-reverse justify-start" : "justify-start")}>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-50 text-rose-400">
          {post.is_anonymous ? <Shield className="h-5 w-5" /> : isSeed ? <Sparkles className="h-5 w-5" /> : <User className="h-5 w-5" />}
        </div>
        <div className={cn("min-w-0 flex-1", isRTL ? "text-right" : "text-left")}>
          <div className={cn("flex flex-wrap items-center gap-2", isRTL ? "justify-start flex-row-reverse" : "justify-start")}>
            <span className="rounded-full bg-rose-50 px-2 py-1 text-[10px] font-bold text-rose-500">
              {t(`category_${post.category}` as any) || post.category}
            </span>
            <h4 className="truncate text-sm font-bold text-rose-950">{authorName}</h4>
          </div>
          <p className="mt-1 text-[11px] text-slate-400">{formatRelativeTime(post.created_at, isRTL)}</p>
        </div>
      </div>

      <p className="whitespace-pre-wrap text-right text-[15px] leading-8 text-slate-700">{post.content}</p>

      {error && <p className="rounded-2xl bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">{error}</p>}

      <div className="flex items-center justify-between border-t border-rose-50 pt-3">
        <button
          onClick={() => setShowComments(value => !value)}
          className="flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold text-slate-400 transition hover:bg-slate-50"
        >
          <MessageSquare className="h-5 w-5" />
          <span>{post.comments?.length || 0}</span>
        </button>
        <button
          onClick={handleLike}
          disabled={isSeed || busy}
          className={cn(
            "flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-bold transition",
            liked ? "bg-rose-50 text-rose-600" : "text-slate-400 hover:bg-slate-50",
            isSeed && "opacity-50"
          )}
        >
          <Heart className={cn("h-5 w-5", liked && "fill-current")} />
          <span>{post.like_user_ids?.length || 0}</span>
        </button>
      </div>

      <AnimatePresence>
        {showComments && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pt-2">
              {(post.comments || []).map(comment => (
                <div key={comment.id} className="rounded-3xl bg-rose-50/60 p-3 text-right">
                  <div className="mb-1 flex items-center justify-end gap-2">
                    <span className="text-[10px] text-slate-400">{formatRelativeTime(comment.created_at, isRTL)}</span>
                    <span className="text-xs font-bold text-rose-900">{comment.is_anonymous ? t('guest_user') : comment.author_name}</span>
                  </div>
                  <p className="text-xs leading-6 text-slate-600">{comment.content}</p>
                </div>
              ))}

              {!isSeed && (
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleComment}
                    disabled={!commentText.trim() || busy}
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-rose-600 text-white shadow-lg shadow-rose-100 transition disabled:bg-slate-100 disabled:text-slate-300"
                  >
                    <Send className="h-4 w-4" />
                  </button>
                  <input
                    value={commentText}
                    onChange={(event) => setCommentText(event.target.value)}
                    placeholder={t('add_comment')}
                    className="h-11 flex-1 rounded-2xl border border-rose-100 bg-white px-4 text-right text-sm outline-none focus:border-rose-300"
                  />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  );
};
