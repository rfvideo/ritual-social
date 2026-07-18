// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IRitualTreasury} from "./interfaces/IRitualTreasury.sol";

/// @title RitualSocial
/// @notice On-chain social graph + content ledger for Ritual Social.
///         Every social action (post, like, comment, repost) costs a fixed
///         action fee that is forwarded to the RitualTreasury contract.
///         Content itself (images) lives on decentralized storage — this
///         contract only ever stores the resulting URI/CID reference.
contract RitualSocial is ReentrancyGuard, Ownable {
    // ─────────────────────────────────────────────────────────────────
    // Errors
    // ─────────────────────────────────────────────────────────────────
    error IncorrectFee(uint256 sent, uint256 required);
    error PostDoesNotExist(uint256 postId);
    error AlreadyLiked(uint256 postId, address account);
    error AlreadyReposted(uint256 postId, address account);
    error CannotFollowSelf();
    error NotFollowing(address account);
    error EmptyContentURI();
    error TreasuryTransferFailed();

    // ─────────────────────────────────────────────────────────────────
    // Config
    // ─────────────────────────────────────────────────────────────────

    /// @notice Flat fee (in wei) charged for every write action: post,
    ///         like, comment, repost. Mirrors the 0.005 native-token fee
    ///         described in the product spec.
    uint256 public actionFee = 0.005 ether;

    /// @notice Treasury that receives 100% of collected action fees.
    IRitualTreasury public treasury;

    // ─────────────────────────────────────────────────────────────────
    // Storage
    // ─────────────────────────────────────────────────────────────────

    struct Post {
        address author;
        string contentURI; // decentralized-storage reference (ipfs://CID or similar)
        uint64 timestamp;
        uint64 likeCount;
        uint64 commentCount;
        uint64 repostCount;
        bool isRepost;
        uint256 originalPostId; // meaningful only if isRepost
        bool exists;
    }

    struct Comment {
        address author;
        uint256 postId;
        string contentURI;
        uint64 timestamp;
    }

    struct Profile {
        string metadataURI; // avatar / banner / bio / display name / website / location
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
    mapping(uint256 => uint256[]) private _postComments; // postId => commentIds

    mapping(address => Profile) public profiles;
    mapping(uint256 => mapping(address => bool)) public hasLiked;
    mapping(uint256 => mapping(address => bool)) public hasReposted;
    mapping(address => mapping(address => bool)) public isFollowing; // follower => followee => bool

    // ─────────────────────────────────────────────────────────────────
    // Events — every field the UI / Explorer needs to verify an action
    // ─────────────────────────────────────────────────────────────────

    event ProfileUpdated(address indexed account, string metadataURI, uint64 timestamp);

    event PostCreated(
        uint256 indexed postId,
        address indexed author,
        string contentURI,
        uint64 timestamp
    );

    event PostLiked(
        uint256 indexed postId,
        address indexed liker,
        address indexed author,
        uint64 timestamp
    );

    event CommentAdded(
        uint256 indexed commentId,
        uint256 indexed postId,
        address indexed author,
        string contentURI,
        uint64 timestamp
    );

    event PostReposted(
        uint256 indexed postId,
        uint256 indexed newPostId,
        address indexed reposter,
        uint64 timestamp
    );

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

    /// @notice Wallet-first identity: first write of any kind auto-registers
    ///         the account. Editing metadata is free — only content actions
    ///         that need spam resistance carry a fee.
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
            exists: true
        });

        profiles[msg.sender].postCount += 1;
        emit PostCreated(postId, msg.sender, contentURI, uint64(block.timestamp));
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

    function commentOnPost(uint256 postId, string calldata contentURI)
        external
        payable
        nonReentrant
        returns (uint256 commentId)
    {
        Post storage post = posts[postId];
        if (!post.exists) revert PostDoesNotExist(postId);
        if (bytes(contentURI).length == 0) revert EmptyContentURI();

        _chargeFee();
        _ensureRegistered(msg.sender);

        commentId = nextCommentId++;
        comments[commentId] = Comment({
            author: msg.sender,
            postId: postId,
            contentURI: contentURI,
            timestamp: uint64(block.timestamp)
        });
        _postComments[postId].push(commentId);
        post.commentCount += 1;

        emit CommentAdded(commentId, postId, msg.sender, contentURI, uint64(block.timestamp));
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
            exists: true
        });

        profiles[msg.sender].postCount += 1;
        emit PostReposted(postId, newPostId, msg.sender, uint64(block.timestamp));
    }

    function commentIdsForPost(uint256 postId) external view returns (uint256[] memory) {
        return _postComments[postId];
    }

    // ─────────────────────────────────────────────────────────────────
    // Follow graph — free, no spam surface beyond normal gas cost
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
