import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-start justify-center gap-6 px-6 py-20">
      <p className="font-mono text-xs/6 tracking-widest text-gray-500 uppercase dark:text-gray-400">404</p>
      <h1 className="text-4xl font-semibold tracking-tight">문서를 찾을 수 없습니다.</h1>
      <p className="max-w-xl text-base/7 text-gray-700 dark:text-gray-300">
        아직 동기화되지 않았거나 경로가 잘못되었을 수 있습니다. 문서 홈으로 돌아가서 현재 미러링된 페이지를 확인해 주세요.
      </p>
      <Link
        href="/docs"
        className="rounded-full bg-gray-950 px-4 py-2 text-sm font-medium text-white dark:bg-white dark:text-gray-950"
      >
        문서 홈으로 이동
      </Link>
    </main>
  );
}
