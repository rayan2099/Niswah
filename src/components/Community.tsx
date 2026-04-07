/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MessageSquare, 
  Heart, 
  Share2, 
  MoreHorizontal, 
  Plus, 
  Search, 
  Users, 
  TrendingUp,
  Shield,
  User,
  Image as ImageIcon,
  Send
} from 'lucide-react';
import { useTranslation } from '../i18n/LanguageContext.tsx';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Comment {
  id: string;
  author: string;
  content: string;
  timestamp: string;
  isExpert?: boolean;
}

interface Post {
  id: string;
  author: string;
  avatar: string;
  content: string;
  timestamp: string;
  likes: number;
  comments: number;
  isAnonymous: boolean;
  category: 'health' | 'fiqh' | 'mental' | 'general';
  isExpert?: boolean;
  commentsList?: Comment[];
}

const MOCK_POSTS: Post[] = [
  {
    id: '1',
    author: 'مريم أحمد',
    avatar: 'https://picsum.photos/seed/user1/100/100',
    content: 'السلام عليكم يا أخوات، هل من نصيحة لتخفيف آلام الدورة الشهرية بطرق طبيعية؟ جربت شاي الزنجبيل ولكن أحتاج للمزيد من الاقتراحات.',
    timestamp: '2h ago',
    likes: 24,
    comments: 2,
    isAnonymous: false,
    category: 'health',
    commentsList: [
      { id: 'c1', author: 'د. سارة أحمد', content: 'وعليكم السلام، أنصحكِ أيضاً بالقرفة والكمادات الدافئة.', timestamp: '1h ago', isExpert: true },
      { id: 'c2', author: 'فاطمة علي', content: 'جربي المشي الخفيف، يساعد كثيراً.', timestamp: '30m ago' }
    ]
  },
  {
    id: '2',
    author: 'أخت مجهولة',
    avatar: '',
    content: 'أشعر بضيق شديد خلال هذه الأيام من دورتي، هل هذا طبيعي؟ كيف تتعاملون مع التغيرات المزاجية الحادة؟',
    timestamp: '4h ago',
    likes: 45,
    comments: 1,
    isAnonymous: true,
    category: 'mental',
    commentsList: [
      { id: 'c3', author: 'ليلى محمود', content: 'نعم طبيعي جداً بسبب الهرمونات، حاولي الاسترخاء والقراءة.', timestamp: '2h ago' }
    ]
  },
  {
    id: '3',
    author: 'فاطمة علي',
    avatar: 'https://picsum.photos/seed/user3/100/100',
    content: 'الحمد لله، أكملت اليوم أول رحلة إرشادية في التطبيق عن فقه الطهارة. أنصح الجميع بها، المعلومات قيمة جداً ومبسطة.',
    timestamp: '6h ago',
    likes: 89,
    comments: 0,
    isAnonymous: false,
    category: 'fiqh'
  }
];

import { useCycleData } from '../contexts/CycleContext.tsx';

export const Community = () => {
  const { t, isRTL } = useTranslation();
  const { user } = useCycleData();
  const [posts, setPosts] = useState<Post[]>(MOCK_POSTS);
  const [isCreating, setIsCreating] = useState(false);
  const [newPostContent, setNewPostContent] = useState('');
  const [newPostCategory, setNewPostCategory] = useState<Post['category']>('general');
  const [isAnonymous, setIsAnonymous] = useState(user?.anonymous_mode || false);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const handleCreatePost = () => {
    if (!newPostContent.trim()) return;
    
    const authorName = isAnonymous ? t('guest_user') : (user?.display_name || 'أنا');
    
    const newPost: Post = {
      id: Date.now().toString(),
      author: authorName,
      avatar: isAnonymous ? '' : (user?.avatar || 'https://picsum.photos/seed/me/100/100'),
      content: newPostContent,
      timestamp: 'Just now',
      likes: 0,
      comments: 0,
      isAnonymous,
      category: newPostCategory,
      commentsList: []
    };

    setPosts([newPost, ...posts]);
    setNewPostContent('');
    setNewPostCategory('general');
    setIsCreating(false);
    setIsAnonymous(false);
  };

  const filteredPosts = posts.filter(post => {
    const matchesCategory = activeCategory === 'all' || post.category === activeCategory;
    const matchesSearch = post.content.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         post.author.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const categories = [
    { id: 'all', label: t('category_all') },
    { id: 'health', label: t('category_health') },
    { id: 'fiqh', label: t('category_fiqh') },
    { id: 'mental', label: t('category_mental') }
  ];

  return (
    <div className="min-h-screen bg-[#FDFCFB] pb-32">
      {/* Header */}
      <header className="px-6 pt-12 pb-6 bg-white border-b border-black/5 sticky top-0 z-20">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-serif font-bold text-rose-800">{t('community')}</h1>
          <div className="flex items-center space-x-3 rtl:space-x-reverse">
            <div className="relative">
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('search')}
                className="w-40 h-10 bg-rose-50 rounded-full px-10 text-xs text-rose-900 outline-none border border-transparent focus:border-rose-200 transition-all"
              />
              <Search className="w-4 h-4 text-rose-300 absolute left-4 top-1/2 -translate-y-1/2" />
            </div>
            <button className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center text-rose-400">
              <Users className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Category Tabs */}
        <div className="flex space-x-2 rtl:space-x-reverse overflow-x-auto no-scrollbar pb-2">
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "px-6 py-2 rounded-full text-xs font-bold transition-all whitespace-nowrap",
                activeCategory === cat.id 
                  ? "bg-rose-600 text-white shadow-lg shadow-rose-200" 
                  : "bg-rose-50 text-rose-400 hover:bg-rose-100"
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>
      </header>

      <div className="p-6 space-y-8">
        {/* Create Post Trigger */}
        <motion.div 
          whileTap={{ scale: 0.98 }}
          onClick={() => setIsCreating(true)}
          className="p-4 bg-white rounded-[32px] border border-black/5 shadow-sm flex items-center space-x-4 rtl:space-x-reverse cursor-pointer"
        >
          <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center text-rose-200">
            <User className="w-5 h-5" />
          </div>
          <span className="text-sm text-gray-400">{t('post_placeholder')}</span>
          <div className="flex-1" />
          <div className="w-10 h-10 bg-rose-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-rose-200">
            <Plus className="w-5 h-5" />
          </div>
        </motion.div>

        {/* Trending Topics */}
        <section className="space-y-4">
          <div className="flex items-center space-x-2 rtl:space-x-reverse">
            <TrendingUp className="w-4 h-4 text-rose-400" />
            <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('trending_topics')}</h3>
          </div>
          <div className={cn("flex overflow-x-auto no-scrollbar space-x-3", isRTL && "space-x-reverse")}>
            {['#فقه_الطهارة', '#صحة_المرأة', '#رمضان_٢٠٢٤', '#تكيس_المبايض'].map((tag) => (
              <span key={tag} className="px-4 py-2 bg-rose-50 text-rose-800 text-xs font-bold rounded-full border border-rose-100 whitespace-nowrap">
                {tag}
              </span>
            ))}
          </div>
        </section>

        {/* Posts Feed */}
        <div className="space-y-6">
          {filteredPosts.length > 0 ? (
            filteredPosts.map((post) => (
              <PostCard key={post.id} post={post} onAddComment={(content) => {
                const newComment: Comment = {
                  id: Date.now().toString(),
                  author: user?.display_name || 'أنا',
                  content,
                  timestamp: 'Just now'
                };
                setPosts(posts.map(p => p.id === post.id ? {
                  ...p,
                  comments: p.comments + 1,
                  commentsList: [...(p.commentsList || []), newComment]
                } : p));
              }} />
            ))
          ) : (
            <div className="py-20 text-center space-y-4">
              <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-200 mx-auto">
                <Search className="w-8 h-8" />
              </div>
              <p className="text-sm text-gray-400">{t('no_results')}</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Post Modal */}
      <AnimatePresence>
        {isCreating && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[400] bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          >
            <motion.div 
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="w-full max-w-lg bg-white rounded-[40px] overflow-hidden shadow-2xl"
            >
              <div className="p-6 border-b border-black/5 flex items-center justify-between">
                <h3 className="text-lg font-serif font-bold text-rose-900">{t('create_post')}</h3>
                <button onClick={() => setIsCreating(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="flex space-x-2 rtl:space-x-reverse overflow-x-auto no-scrollbar">
                  {categories.filter(c => c.id !== 'all').map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setNewPostCategory(cat.id as Post['category'])}
                      className={cn(
                        "px-4 py-2 rounded-xl text-[10px] font-bold transition-all whitespace-nowrap border",
                        newPostCategory === cat.id 
                          ? "bg-rose-600 text-white border-rose-600" 
                          : "bg-white text-gray-400 border-gray-100"
                      )}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>

                <textarea 
                  autoFocus
                  value={newPostContent}
                  onChange={(e) => setNewPostContent(e.target.value)}
                  placeholder={t('post_placeholder')}
                  className="w-full h-40 bg-transparent border-none outline-none text-rose-900 placeholder:text-gray-300 resize-none text-lg leading-relaxed"
                />
                
                <div className="flex items-center justify-between pt-4 border-t border-black/5">
                  <div className="flex items-center space-x-4 rtl:space-x-reverse">
                    <button className="p-2 text-rose-400 hover:bg-rose-50 rounded-xl transition-colors">
                      <ImageIcon className="w-6 h-6" />
                    </button>
                <div className="flex items-center gap-2 rtl:flex-row-reverse">
                  <button 
                    onClick={() => setIsAnonymous(!isAnonymous)}
                    className={cn(
                      "w-10 h-5 rounded-full relative transition-colors shrink-0",
                      isAnonymous ? "bg-rose-600" : "bg-gray-200"
                    )}
                  >
                    <div className={cn(
                      "absolute top-1 w-3 h-3 bg-white rounded-full transition-all",
                      isAnonymous 
                        ? (isRTL ? "left-1" : "right-1") 
                        : (isRTL ? "right-1" : "left-1")
                    )} />
                  </button>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{t('post_anonymous')}</span>
                </div>
                  </div>
                  <button 
                    onClick={handleCreatePost}
                    disabled={!newPostContent.trim()}
                    className={cn(
                      "px-8 py-3 rounded-2xl font-bold text-sm transition-all shadow-lg",
                      newPostContent.trim() ? "bg-rose-600 text-white shadow-rose-200" : "bg-gray-100 text-gray-300 shadow-none"
                    )}
                  >
                    {t('post_button')}
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

const PostCard = ({ post, onAddComment }: { post: Post; onAddComment: (content: string) => void }) => {
  const { t, isRTL } = useTranslation();
  const [liked, setLiked] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');

  const handleAddComment = () => {
    if (!commentText.trim()) return;
    onAddComment(commentText);
    setCommentText('');
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="bg-white rounded-[40px] p-6 border border-black/5 shadow-sm space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className={cn("flex items-center gap-3", isRTL && "flex-row-reverse")}>
          <div className="w-10 h-10 rounded-2xl overflow-hidden bg-rose-50 flex items-center justify-center relative shrink-0">
            {post.isAnonymous ? (
              <Shield className="w-5 h-5 text-rose-200" />
            ) : (
              <img src={post.avatar} alt={post.author} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            )}
            {post.isExpert && (
              <div className={cn(
                "absolute -bottom-1 w-4 h-4 bg-emerald-500 rounded-full border-2 border-white flex items-center justify-center",
                isRTL ? "-left-1" : "-right-1"
              )}>
                <Shield className="w-2 h-2 text-white" />
              </div>
            )}
          </div>
          <div className={isRTL ? "text-right" : "text-left"}>
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <h4 className="text-sm font-bold text-rose-900">{post.isAnonymous ? t('guest_user') : post.author}</h4>
              {post.isExpert && (
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 text-[8px] font-bold rounded-full border border-emerald-100 whitespace-nowrap">
                  {t('verified_expert')}
                </span>
              )}
            </div>
            <p className="text-[10px] text-gray-400 font-medium">{post.timestamp} · {t(`category_${post.category}` as any)}</p>
          </div>
        </div>
        <button className="p-2 text-gray-300 hover:text-rose-400 transition-colors shrink-0">
          <MoreHorizontal className="w-5 h-5" />
        </button>
      </div>

      <p className="text-sm text-rose-900 leading-relaxed">
        {post.content}
      </p>

      <div className="pt-4 border-t border-black/5 flex items-center justify-between">
        <div className={cn("flex items-center gap-6", isRTL && "flex-row-reverse")}>
          <button 
            onClick={() => setLiked(!liked)}
            className={cn(
              "flex items-center gap-2 transition-colors",
              liked ? "text-rose-600" : "text-gray-400",
              isRTL && "flex-row-reverse"
            )}
          >
            <Heart className={cn("w-5 h-5", liked && "fill-rose-600")} />
            <span className="text-xs font-bold">{post.likes + (liked ? 1 : 0)}</span>
          </button>
          <button 
            onClick={() => setShowComments(!showComments)}
            className={cn(
              "flex items-center gap-2 transition-colors",
              showComments ? "text-rose-600" : "text-gray-400",
              isRTL && "flex-row-reverse"
            )}
          >
            <MessageSquare className="w-5 h-5" />
            <span className="text-xs font-bold">{post.comments}</span>
          </button>
        </div>
        <button className="p-2 text-gray-400 hover:text-rose-600 transition-colors">
          <Share2 className="w-5 h-5" />
        </button>
      </div>

      {/* Comments Section */}
      <AnimatePresence>
        {showComments && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden space-y-4"
          >
            <div className="space-y-4 pt-4">
              {post.commentsList?.map(comment => (
                <div key={comment.id} className="flex space-x-3 rtl:space-x-reverse bg-rose-50/30 p-3 rounded-2xl">
                  <div className="w-8 h-8 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-rose-300" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2 rtl:space-x-reverse">
                      <span className="text-xs font-bold text-rose-900">{comment.author}</span>
                      {comment.isExpert && (
                        <span className="text-[8px] text-emerald-600 font-bold bg-emerald-50 px-1.5 rounded-full border border-emerald-100">
                          {t('verified_expert')}
                        </span>
                      )}
                      <span className="text-[8px] text-gray-400">{comment.timestamp}</span>
                    </div>
                    <p className="text-xs text-rose-800 leading-relaxed">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center space-x-2 rtl:space-x-reverse pt-2">
              <input 
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                placeholder={t('add_comment')}
                className="flex-1 h-10 bg-rose-50 rounded-2xl px-4 text-xs text-rose-900 outline-none border border-transparent focus:border-rose-200"
              />
              <button 
                onClick={handleAddComment}
                disabled={!commentText.trim()}
                className="w-10 h-10 bg-rose-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-rose-200 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const X = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6L6 18M6 6l12 12" />
  </svg>
);
