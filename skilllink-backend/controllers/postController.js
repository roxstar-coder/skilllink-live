const Post = require('../models/Post');
const User = require('../models/user');
const { saveMediaAsset } = require('../storage/mediaStorage');
const { notifyUser } = require('../utils/notifications');

function serializePost(post, currentUserId) {
    const raw = typeof post.toObject === 'function' ? post.toObject() : { ...post };
    raw.likeCount = (raw.likes || []).length;
    raw.commentCount = (raw.comments || []).length;
    raw.hasLiked = Boolean(currentUserId) && (raw.likes || []).some(id => String(id) === String(currentUserId));
    return raw;
}

function emitPostUpdate(req, event, payload) {
    const io = req.app.get('io');
    if (io) {
        io.emit(event, payload);
    }
}

exports.createPost = async (req, res) => {
    try {
        const content = String(req.body.content || '').trim();
        const mediaInput = Array.isArray(req.body.media) ? req.body.media : [];

        if (!content && mediaInput.length === 0) {
            return res.status(400).json({ message: 'Post text or media is required.' });
        }

        const media = [];
        for (const item of mediaInput.slice(0, 6)) {
            media.push(await saveMediaAsset(item));
        }

        const newPost = new Post({
            user: req.user.userId,
            content,
            media
        });
        await newPost.save();
        
        await newPost.populate('user', 'name email');
        await newPost.populate('comments.user', 'name email');

        emitPostUpdate(req, 'postCreated', { postId: newPost._id });
        
        res.status(201).json(serializePost(newPost, req.user.userId));
    } catch (error) {
        res.status(500).json({ message: 'Error creating post', error: error.message });
    }
};

exports.getPosts = async (req, res) => {
    try {
        const viewer = await User.findById(req.user.userId).select('savedPosts');
        const savedPostIds = new Set((viewer?.savedPosts || []).map(id => String(id)));
        const posts = await Post.find()
            .populate('user', 'name email profilePhoto')
            .populate('comments.user', 'name email profilePhoto')
            .sort({ createdAt: -1 });
        res.json(posts.map(post => {
            const raw = serializePost(post, req.user.userId);
            raw.isSaved = savedPostIds.has(String(raw._id));
            return raw;
        }));
    } catch (error) {
        res.status(500).json({ message: 'Error fetching posts', error: error.message });
    }
};

exports.likePost = async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        const userId = req.user.userId;
        const hasLiked = post.likes.some(id => String(id) === String(userId));

        if (hasLiked) {
            post.likes = post.likes.filter(id => String(id) !== String(userId));
        } else {
            post.likes.push(userId);
        }

        await post.save();

        if (!hasLiked && post.user.toString() !== userId) {
            await notifyUser(req, {
                recipient: post.user,
                actor: userId,
                type: 'post_liked',
                title: 'New like on your post',
                message: 'Someone liked your post.',
                link: 'dashboard'
            });
        }

        emitPostUpdate(req, 'postUpdated', { postId: post._id, action: 'like' });

        res.json({
            message: hasLiked ? 'Unliked' : 'Liked',
            likes: post.likes.length,
            liked: !hasLiked
        });
    } catch (error) {
        res.status(500).json({ message: 'Error liking post', error: error.message });
    }
};

exports.addComment = async (req, res) => {
    try {
        const content = String(req.body.content || '').trim();
        const parentCommentId = req.body.parentCommentId || null;

        if (!content) {
            return res.status(400).json({ message: 'Comment text is required.' });
        }

        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ message: 'Post not found' });
        }

        if (parentCommentId) {
            const parentExists = post.comments.some(comment => String(comment._id) === String(parentCommentId));
            if (!parentExists) {
                return res.status(400).json({ message: 'Parent comment not found.' });
            }
        }

        post.comments.push({
            user: req.user.userId,
            content,
            parentCommentId
        });
        await post.save();
        await post.populate('comments.user', 'name email');

        if (String(post.user) !== String(req.user.userId)) {
            await notifyUser(req, {
                recipient: post.user,
                actor: req.user.userId,
                type: 'post_commented',
                title: 'New comment on your post',
                message: 'Someone commented on your post.',
                link: 'dashboard'
            });
        }

        emitPostUpdate(req, 'postUpdated', { postId: post._id, action: 'comment' });

        res.status(201).json({
            message: 'Comment added',
            post: serializePost(post, req.user.userId)
        });
    } catch (error) {
        res.status(500).json({ message: 'Error adding comment', error: error.message });
    }
};
