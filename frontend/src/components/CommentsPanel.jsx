export default function CommentsPanel({
  comments,
  commentText,
  onCommentChange,
  onAddComment,
  loadingComments,
  commentSaving,
  textareaId = 'commentText',
  title = 'Comments',
}) {
  return (
    <div>
      <h4 className="text-lg font-semibold text-slate-900">{title}</h4>

      <div className="mt-3 max-h-64 space-y-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-4">
        {loadingComments ? (
          <p className="text-sm text-slate-600">Loading comments...</p>
        ) : comments.length ? (
          comments.map((comment) => (
            <div key={comment.id} className="rounded-2xl bg-white p-3 shadow-sm">
              <p className="text-sm leading-6 text-slate-700">{comment.content}</p>
              <p className="mt-2 text-xs text-slate-500">
                {comment.user_name || 'User'} •{' '}
                {comment.created_at ? new Date(comment.created_at).toLocaleString() : '—'}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-600">No comments yet.</p>
        )}
      </div>

      <div className="mt-4">
        <label className="label" htmlFor={textareaId}>Add comment</label>
        <textarea
          id={textareaId}
          value={commentText}
          onChange={onCommentChange}
          className="input min-h-28 resize-none"
          placeholder="Write your comment here..."
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            className="btn-primary"
            onClick={onAddComment}
            disabled={commentSaving || !commentText.trim()}
          >
            {commentSaving ? 'Adding comment...' : 'Add Comment'}
          </button>
        </div>
      </div>
    </div>
  );
}
