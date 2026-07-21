// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRitualTreasury} from "./interfaces/IRitualTreasury.sol";

/// @title RitualSocialV2
/// @notice On-chain social graph + content ledger for Ritual Social, v2.
///         Adds post edit/delete, comment likes, comment edit/delete, and
///         real on-chain threaded replies (a comment can reply to another
///         comment, not just to the post) on top of the original v1 design.
///         This is a fresh contract — it does not inherit v1's state.
contract RitualSocialV2 is ReentrancyGuard, Ownable {
    // ─────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────
    error IncorrectFee(uint256 sent, uint256 required);
    error PostDoesNotExist(uint256 postId);
    error CommentDoesNotExist(uint256 commentId);
    error AlreadyLiked(uint256 postId, address account);
    error AlreadyLikedComment(uint256 commentId, address account);
    error AlreadyReposted(uint256 postId, address account);
    error CannotFollowSelf();
    error NotFollowing(address account);
    error EmptyContentURI();
    error TreasuryTransferFailed();
    error NotPostAuthor(uint256 postId, address caller);
    error NotCommentAuthor(uint256 commentId, address caller);
    error ParentCommentMismatch(uint256 parentCommentId, uint256 postId);

    // ─────────────────────────────────────────────────────────────────
    // Config
    // ─────────────────────────────────────────────────────────────────

    uint256 public actionFee = 0.005 ether;

    IRitualTreasury public treasury;

    // ─────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────

    struct Post {
        address author;
        string contentURI;
        uint64 timestamp;
        uint64 likeCount;
        uint64 commentCount;
        uint64 repostCount;
        bool isRepost;
        uint256 originalPostId;
        bool exists;
        bool edited;
    }

    struct Comment {
        address author;
        uint256 postId;
        uint256 parentCommentId; // 0 = top-level reply to the post itself
        string contentURI;
        uint64 timestamp;
        uint64 likeCount;
        uint64 replyCount;
        bool exists;
        bool edited;
    }

    struct Profile {
        string metadataURI;
        uint64 joinedAt;
        uint64 postCount;
        uint64 followerCount;
        uint64 followingCount;
        bool registered;
    }

    uint256 public nextPostId = 1;
    uint256 public nextCommentId = 1;

    mapping(uint256 => Post) public posts;
    mapping(uint256 => Comment) public comments;
    mapping(uint256 => uint256[]) private _postComments;
    mapping(uint256 => uint256[]) private _commentReplies;

    mapping(address => Profile) public profiles;
    mapping(uint256 => mapping(address => bool)) public hasLiked;
    mapping(uint256 => mapping(address => bool)) public hasLikedComment;
    mapping(uint256 => mapping(address => bool)) public hasReposted;
    mapping(address => mapping(address => bool)) public isFollowing;

    // ─────────────────────────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────────────────────────

    event ProfileUpdated(address indexed account, string metadataURI, uint64 timestamp);

    event PostCreated(uint256 indexed postId, address indexed author, string contentURI, uint64 timestamp);
    event PostEdited(uint256 indexed postId, string newContentURI, uint64 timestamp);
    event PostDeleted(uint256 indexed postId, uint64 timestamp);
    event PostLiked(uint256 indexed postId, address indexed liker, address indexed author, uint64 timestamp);

    event CommentAdded(
        uint256 indexed commentId,
        uint256 indexed postId,
        uint256 parentCommentId,
        address indexed author,
        string contentURI,
        uint64 timestamp
    );
    event CommentEdited(uint256 indexed commentId, string newContentURI, uint64 timestamp);
    event CommentDeleted(uint256 indexed commentId, uint64 timestamp);
    event CommentLiked(uint256 indexed commentId, address indexed liker, address indexed author, uint64 timestamp);

    event PostReposted(uint256 indexed postId, uint256 indexed newPostId, address indexed reposter, uint64 timestamp);

    event Followed(address indexed follower, address indexed followee, uint64 timestamp);
    event Unfollowed(address indexed follower, address indexed followee, uint64 timestamp);
    event ActionFeeUpdated(uint256 oldFee, uint256 newFee);
    event TreasuryUpdated(address oldTreasury, address newTreasury);

    // ─────────────────────────────────────────────────────────────────

    constructor(address treasuryAddress, address initialOwner) Ownable(initialOwner) {
        treasury = IRitualTreasury(treasuryAddress);
    }

    // ─────────────────────────────────────────────────────────────────
    // Profile
    // ─────────────────────────────────────────────────────────────────

    function updateProfile(string calldata metadataURI) external {
        Profile storage p = profiles[msg.sender];
        if (!p.registered) {
            p.registered = true;
            p.joinedAt = uint64(block.timestamp);
        }
        p.metadataURI = metadataURI;
        emit ProfileUpdated(msg.sender, metadataURI, uint64(block.timestamp));
    }

    function _ensureRegistered(address account) internal {
        Profile storage p = profiles[account];
        if (!p.registered) {
            p.registered = true;
            p.joinedAt = uint64(block.timestamp);
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // Posting
    // ─────────────────────────────────────────────────────────────────

    function createPost(string calldata contentURI) external payable nonReentrant returns (uint256 postId) {
        if (bytes(contentURI).length == 0) revert EmptyContentURI();
        _chargeFee();
        _ensureRegistered(msg.sender);

        postId = nextPostId++;
        posts[postId] = Post({
            author: msg.sender,
            contentURI: contentURI,
            timestamp: uint64(block.timestamp),
            likeCount: 0,
            commentCount: 0,
            repostCount: 0,
            isRepost: false,
            originalPostId: 0,
            exists: true,
            edited: false
        });

        profiles[msg.sender].postCount += 1;
        emit PostCreated(postId, msg.sender, contentURI, uint64(block.timestamp));
    }

    function editPost(uint256 postId, string calldata newContentURI) external {
        Post storage post = posts[postId];
        if (!post.exists) revert PostDoesNotExist(postId);
        if (post.author != msg.sender) revert NotPostAuthor(postId, msg.sender);
        if (bytes(newContentURI).length == 0) revert EmptyContentURI();

        post.contentURI = newContentURI;
        post.edited = true;
        emit PostEdited(postId, newContentURI, uint64(block.timestamp));
    }

    function deletePost(uint256 postId) external {
        Post storage post = posts[postId];
        if (!post.exists) revert PostDoesNotExist(postId);
        if (post.author != msg.sender) revert NotPostAuthor(postId, msg.sender);

        post.exists = false;
        if (profiles[msg.sender].postCount > 0) {
            profiles[msg.sender].postCount -= 1;
        }
        emit PostDeleted(postId, uint64(block.timestamp));
    }

    function likePost(uint256 postId) external payable nonReentrant {
        Post storage post = posts[postId];
        if (!post.exists) revert PostDoesNotExist(postId);
        if (hasLiked[postId][msg.sender]) revert AlreadyLiked(postId, msg.sender);

        _chargeFee();
        _ensureRegistered(msg.sender);

        hasLiked[postId][msg.sender] = true;
        post.likeCount += 1;

        emit PostLiked(postId, msg.sender, post.author, uint64(block.timestamp));
    }

    function commentOnPost(uint256 postId, uint256 parentCommentId, string calldata contentURI)
        external
        payable
        nonReentrant
        returns (uint256 commentId)
    {
        Post storage post = posts[postId];
        if (!post.exists) revert PostDoesNotExist(postId);
        if (bytes(contentURI).length == 0) revert EmptyContentURI();

        if (parentCommentId != 0) {
            Comment storage parent = comments[parentCommentId];
            if (!parent.exists) revert CommentDoesNotExist(parentCommentId);
            if (parent.postId != postId) revert ParentCommentMismatch(parentCommentId, postId);
        }

        _chargeFee();
        _ensureRegistered(msg.sender);

        commentId = nextCommentId++;
        comments[commentId] = Comment({
            author: msg.sender,
            postId: postId,
            parentCommentId: parentCommentId,
            contentURI: contentURI,
            timestamp: uint64(block.timestamp),
            likeCount: 0,
            replyCount: 0,
            exists: true,
            edited: false
        });
        _postComments[postId].push(commentId);
        post.commentCount += 1;

        if (parentCommentId != 0) {
            comments[parentCommentId].replyCount += 1;
            _commentReplies[parentCommentId].push(commentId);
        }

        emit CommentAdded(commentId, postId, parentCommentId, msg.sender, contentURI, uint64(block.timestamp));
    }

    function editComment(uint256 commentId, string calldata newContentURI) external {
        Comment storage comment = comments[commentId];
        if (!comment.exists) revert CommentDoesNotExist(commentId);
        if (comment.author != msg.sender) revert NotCommentAuthor(commentId, msg.sender);
        if (bytes(newContentURI).length == 0) revert EmptyContentURI();

        comment.contentURI = newContentURI;
        comment.edited = true;
        emit CommentEdited(commentId, newContentURI, uint64(block.timestamp));
    }

    function deleteComment(uint256 commentId) external {
        Comment storage comment = comments[commentId];
        if (!comment.exists) revert CommentDoesNotExist(commentId);
        if (comment.author != msg.sender) revert NotCommentAuthor(commentId, msg.sender);

        comment.exists = false;
        Post storage post = posts[comment.postId];
        if (post.exists && post.commentCount > 0) {
            post.commentCount -= 1;
        }
        emit CommentDeleted(commentId, uint64(block.timestamp));
    }

    function likeComment(uint256 commentId) external payable nonReentrant {
        Comment storage comment = comments[commentId];
        if (!comment.exists) revert CommentDoesNotExist(commentId);
        if (hasLikedComment[commentId][msg.sender]) revert AlreadyLikedComment(commentId, msg.sender);

        _chargeFee();
        _ensureRegistered(msg.sender);

        hasLikedComment[commentId][msg.sender] = true;
        comment.likeCount += 1;

        emit CommentLiked(commentId, msg.sender, comment.author, uint64(block.timestamp));
    }

    function repost(uint256 postId) external payable nonReentrant returns (uint256 newPostId) {
        Post storage original = posts[postId];
        if (!original.exists) revert PostDoesNotExist(postId);
        if (hasReposted[postId][msg.sender]) revert AlreadyReposted(postId, msg.sender);

        _chargeFee();
        _ensureRegistered(msg.sender);

        hasReposted[postId][msg.sender] = true;
        original.repostCount += 1;

        newPostId = nextPostId++;
        posts[newPostId] = Post({
            author: msg.sender,
            contentURI: original.contentURI,
            timestamp: uint64(block.timestamp),
            likeCount: 0,
            commentCount: 0,
            repostCount: 0,
            isRepost: true,
            originalPostId: postId,
            exists: true,
            edited: false
        });

        profiles[msg.sender].postCount += 1;
        emit PostReposted(postId, newPostId, msg.sender, uint64(block.timestamp));
    }

    function commentIdsForPost(uint256 postId) external view returns (uint256[] memory) {
        return _postComments[postId];
    }

    function replyIdsForComment(uint256 commentId) external view returns (uint256[] memory) {
        return _commentReplies[commentId];
    }

    // ─────────────────────────────────────────────────────────────────
    // Follow graph
    // ─────────────────────────────────────────────────────────────────

    function follow(address account) external {
        if (account == msg.sender) revert CannotFollowSelf();
        if (isFollowing[msg.sender][account]) return;

        _ensureRegistered(msg.sender);
        _ensureRegistered(account);

        isFollowing[msg.sender][account] = true;
        profiles[msg.sender].followingCount += 1;
        profiles[account].followerCount += 1;

        emit Followed(msg.sender, account, uint64(block.timestamp));
    }

    function unfollow(address account) external {
        if (!isFollowing[msg.sender][account]) revert NotFollowing(account);

        isFollowing[msg.sender][account] = false;
        profiles[msg.sender].followingCount -= 1;
        profiles[account].followerCount -= 1;

        emit Unfollowed(msg.sender, account, uint64(block.timestamp));
    }

    // ─────────────────────────────────────────────────────────────────
    // Admin
    // ─────────────────────────────────────────────────────────────────

    function setActionFee(uint256 newFee) external onlyOwner {
        emit ActionFeeUpdated(actionFee, newFee);
        actionFee = newFee;
    }

    function setTreasury(address newTreasury) external onlyOwner {
        emit TreasuryUpdated(address(treasury), newTreasury);
        treasury = IRitualTreasury(newTreasury);
    }

    // ─────────────────────────────────────────────────────────────────
    // Internal
    // ─────────────────────────────────────────────────────────────────

    function _chargeFee() internal {
        if (msg.value != actionFee) revert IncorrectFee(msg.value, actionFee);
        (bool ok, ) = address(treasury).call{value: msg.value}(
            abi.encodeWithSelector(IRitualTreasury.deposit.selector, msg.sender)
        );
        if (!ok) revert TreasuryTransferFailed();
    }
}
