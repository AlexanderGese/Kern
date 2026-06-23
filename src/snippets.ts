// src/snippets.ts — curated code snippets registered as Monaco completions.
// Trigger by typing the prefix; ${1:..} are tab-stops.
type Monaco = typeof import("monaco-editor");

interface Snip {
  label: string;
  body: string;
  detail?: string;
}

const SNIPPETS: Record<string, Snip[]> = {
  python: [
    { label: "def", body: "def ${1:name}(${2:args}):\n\t${3:pass}", detail: "function" },
    { label: "class", body: "class ${1:Name}:\n\tdef __init__(self${2:, args}):\n\t\t${3:pass}", detail: "class" },
    { label: "for", body: "for ${1:item} in ${2:iterable}:\n\t${3:pass}", detail: "for loop" },
    { label: "ifmain", body: 'if __name__ == "__main__":\n\t${1:main()}', detail: "main guard" },
    { label: "try", body: "try:\n\t${1:pass}\nexcept ${2:Exception} as ${3:e}:\n\t${4:pass}", detail: "try/except" },
    { label: "with", body: "with ${1:open(${2:path})} as ${3:f}:\n\t${4:pass}", detail: "with" },
    { label: "print", body: 'print(${1:value})', detail: "print" },
  ],
  javascript: [
    { label: "function", body: "function ${1:name}(${2:args}) {\n\t${3}\n}", detail: "function" },
    { label: "arrow", body: "const ${1:name} = (${2:args}) => {\n\t${3}\n};", detail: "arrow fn" },
    { label: "log", body: "console.log(${1});", detail: "console.log" },
    { label: "import", body: 'import ${1:mod} from "${2:pkg}";', detail: "import" },
    { label: "forof", body: "for (const ${1:item} of ${2:items}) {\n\t${3}\n}", detail: "for…of" },
    { label: "try", body: "try {\n\t${1}\n} catch (${2:err}) {\n\t${3}\n}", detail: "try/catch" },
  ],
  typescript: [
    { label: "function", body: "function ${1:name}(${2:args}): ${3:void} {\n\t${4}\n}", detail: "function" },
    { label: "arrow", body: "const ${1:name} = (${2:args}): ${3:void} => {\n\t${4}\n};", detail: "arrow fn" },
    { label: "interface", body: "interface ${1:Name} {\n\t${2:field}: ${3:string};\n}", detail: "interface" },
    { label: "type", body: "type ${1:Name} = {\n\t${2:field}: ${3:string};\n};", detail: "type" },
    { label: "log", body: "console.log(${1});", detail: "console.log" },
    { label: "import", body: 'import { ${1} } from "${2:pkg}";', detail: "import" },
  ],
  rust: [
    { label: "fn", body: "fn ${1:name}(${2:args}) -> ${3:()} {\n\t${4}\n}", detail: "function" },
    { label: "struct", body: "struct ${1:Name} {\n\t${2:field}: ${3:String},\n}", detail: "struct" },
    { label: "impl", body: "impl ${1:Name} {\n\t${2}\n}", detail: "impl block" },
    { label: "match", body: "match ${1:expr} {\n\t${2:pattern} => ${3:value},\n\t_ => ${4},\n}", detail: "match" },
    { label: "test", body: "#[test]\nfn ${1:name}() {\n\t${2:assert!(true)};\n}", detail: "test" },
    { label: "println", body: 'println!("${1}", ${2});', detail: "println!" },
  ],
  go: [
    { label: "func", body: "func ${1:name}(${2:args}) ${3:error} {\n\t${4}\n}", detail: "function" },
    { label: "main", body: 'package main\n\nimport "fmt"\n\nfunc main() {\n\t${1:fmt.Println("hello")}\n}', detail: "main" },
    { label: "iferr", body: "if err != nil {\n\t${1:return err}\n}", detail: "if err" },
    { label: "for", body: "for ${1:i} := 0; ${1:i} < ${2:n}; ${1:i}++ {\n\t${3}\n}", detail: "for loop" },
  ],
  c: [
    { label: "main", body: "int main(int argc, char **argv) {\n\t${1:return 0;}\n}", detail: "main" },
    { label: "for", body: "for (int ${1:i} = 0; ${1:i} < ${2:n}; ${1:i}++) {\n\t${3}\n}", detail: "for" },
    { label: "include", body: "#include <${1:stdio.h}>", detail: "include" },
    { label: "printf", body: 'printf("${1}\\n"${2});', detail: "printf" },
  ],
};
SNIPPETS.cpp = SNIPPETS.c;

export function registerSnippets(monaco: Monaco) {
  for (const [lang, snips] of Object.entries(SNIPPETS)) {
    monaco.languages.registerCompletionItemProvider(lang, {
      provideCompletionItems(model, position) {
        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn,
        };
        return {
          suggestions: snips.map((s) => ({
            label: s.label,
            kind: monaco.languages.CompletionItemKind.Snippet,
            insertText: s.body,
            insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
            detail: s.detail ?? "snippet",
            documentation: { value: "```\n" + s.body.replace(/\$\{\d+:?([^}]*)\}/g, "$1") + "\n```" },
            range,
          })),
        };
      },
    });
  }
}
