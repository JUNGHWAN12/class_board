import hljs from "highlight.js/lib/core";
import c from "highlight.js/lib/languages/c";
import css from "highlight.js/lib/languages/css";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import python from "highlight.js/lib/languages/python";
import sql from "highlight.js/lib/languages/sql";
import xml from "highlight.js/lib/languages/xml";

// 수업에서 쓰는 언어만 넣어서 화면 크기를 줄입니다 (계획서 2-1).
hljs.registerLanguage("python", python);
hljs.registerLanguage("c", c);
hljs.registerLanguage("java", java);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("sql", sql);

// 글쓰기 창 [코드 넣기] 의 언어 목록. key 는 ``` 뒤에 붙는 이름.
export const CODE_LANGS: { key: string; label: string }[] = [
  { key: "python", label: "Python" },
  { key: "c", label: "C" },
  { key: "java", label: "Java" },
  { key: "javascript", label: "JavaScript" },
  { key: "html", label: "HTML" },
  { key: "css", label: "CSS" },
  { key: "sql", label: "SQL" },
  { key: "", label: "기타" },
];

const ALIASES: Record<string, string> = { py: "python", js: "javascript", htm: "html", cpp: "c", "c++": "c" };

export function normalizeLang(lang: string) {
  const l = lang.toLowerCase();
  return ALIASES[l] ?? l;
}

export function langLabel(lang: string) {
  const l = normalizeLang(lang);
  return CODE_LANGS.find((x) => x.key === l)?.label ?? (lang || "코드");
}

const escapeHtml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// 색을 입힌 HTML 을 돌려줍니다. highlight.js 는 코드 글자를 모두 이스케이프하므로
// 학생이 <script> 를 올려도 실행되지 않고 글자로만 보입니다.
export function highlight(code: string, lang: string): string {
  const l = normalizeLang(lang);
  if (l && hljs.getLanguage(l)) {
    return hljs.highlight(code, { language: l, ignoreIllegals: true }).value;
  }
  return escapeHtml(code);
}
