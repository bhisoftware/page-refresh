export type ThreadReply = {
  id: string;
  authorName: string;
  content: string;
  createdAt: string;
};

export type ThreadedNote = {
  id: string;
  authorName: string;
  content: string;
  anchor: string | null;
  category: string | null;
  parentId: string | null;
  resolvedAt: string | null;
  createdAt: string;
  replies: ThreadReply[];
};
