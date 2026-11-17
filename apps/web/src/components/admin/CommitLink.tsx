import { commitUrl, shortSha } from './content-version';

/** Short SHA, linked to GitHub when the source is a GitHub repo. */
export function CommitLink({ sourceRepo, sha }: { sourceRepo: string; sha: string }) {
  const url = commitUrl(sourceRepo, sha);
  const text = <code className="font-mono text-xs">{shortSha(sha)}</code>;
  if (!url) return <span title={sha}>{text}</span>;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      title={`${sha} trên GitHub`}
      className="hover:text-brand-600 hover:underline"
    >
      {text}
    </a>
  );
}
