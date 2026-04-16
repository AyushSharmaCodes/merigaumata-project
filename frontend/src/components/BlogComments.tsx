import * as React from 'react';
import { CommentSystem } from "./comments/CommentSystem";

interface BlogCommentsProps {
  blogId: string;
}

export const BlogComments = ({ blogId }: BlogCommentsProps) => {
  return <CommentSystem blogId={blogId} />;
};
