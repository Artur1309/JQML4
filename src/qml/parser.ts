/**
 * Minimal QML parser.
 *
 * Supports a subset of QML:
 *   - `import ...` lines (ignored)
 *   - Object tree: `Type { key: value; ChildType { ... } }`
 *   - Element types: Item, Rectangle, Text, Image, MouseArea
 *   - Properties: id, x, y, width, height, color, text, source, fontSize
 *   - Values: numbers, quoted strings, identifiers (treated as strings)
 */

export interface QmlNode {
  type: string;
  props: Record<string, string | number>;
  children: QmlNode[];
}

type Token =
  | { kind: "ident"; value: string }
  | { kind: "string"; value: string }
  | { kind: "number"; value: number }
  | { kind: "lbrace" }
  | { kind: "rbrace" }
  | { kind: "colon" }
  | { kind: "semicolon" }
  | { kind: "newline" };

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];

    // Skip single-line comments
    if (ch === "/" && src[i + 1] === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }

    // Whitespace (not newline)
    if (ch === " " || ch === "\t" || ch === "\r") {
      i++;
      continue;
    }

    // Newline
    if (ch === "\n") {
      tokens.push({ kind: "newline" });
      i++;
      continue;
    }

    // Quoted string
    if (ch === '"' || ch === "'") {
      const quote = ch;
      i++;
      let str = "";
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\" && i + 1 < src.length) {
          i++;
          const esc = src[i];
          if (esc === "n") str += "\n";
          else if (esc === "t") str += "\t";
          else str += esc;
        } else {
          str += src[i];
        }
        i++;
      }
      i++; // closing quote
      tokens.push({ kind: "string", value: str });
      continue;
    }

    // Number (including negative)
    if (ch === "-" || (ch >= "0" && ch <= "9")) {
      let num = ch;
      i++;
      while (i < src.length && ((src[i] >= "0" && src[i] <= "9") || src[i] === ".")) {
        num += src[i++];
      }
      const parsed = parseFloat(num);
      if (!isNaN(parsed)) {
        tokens.push({ kind: "number", value: parsed });
        continue;
      }
      // Not a number — treat as ident start
      i -= num.length - 1;
    }

    if (ch === "{") { tokens.push({ kind: "lbrace" }); i++; continue; }
    if (ch === "}") { tokens.push({ kind: "rbrace" }); i++; continue; }
    if (ch === ":") { tokens.push({ kind: "colon" }); i++; continue; }
    if (ch === ";") { tokens.push({ kind: "semicolon" }); i++; continue; }

    // Identifier (including dotted like QtQuick.2.0)
    if (/[A-Za-z_]/.test(ch)) {
      let ident = "";
      while (i < src.length && /[A-Za-z0-9_.\-]/.test(src[i])) {
        ident += src[i++];
      }
      tokens.push({ kind: "ident", value: ident });
      continue;
    }

    // Skip anything else
    i++;
  }

  return tokens;
}

class Parser {
  private tokens: Token[];
  private pos = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
  }

  private peek(): Token | undefined {
    this.skipNewlinesSemicolons();
    return this.tokens[this.pos];
  }

  private consume(): Token {
    this.skipNewlinesSemicolons();
    return this.tokens[this.pos++];
  }

  private skipNewlinesSemicolons(): void {
    while (
      this.pos < this.tokens.length &&
      (this.tokens[this.pos].kind === "newline" ||
        this.tokens[this.pos].kind === "semicolon")
    ) {
      this.pos++;
    }
  }

  parseFile(): QmlNode {
    // Skip import lines
    while (this.pos < this.tokens.length) {
      const tok = this.tokens[this.pos];
      if (tok.kind === "newline" || tok.kind === "semicolon") {
        this.pos++;
        continue;
      }
      if (tok.kind === "ident" && tok.value === "import") {
        // skip until end of line
        while (this.pos < this.tokens.length && this.tokens[this.pos].kind !== "newline") {
          this.pos++;
        }
        continue;
      }
      break;
    }
    return this.parseObject();
  }

  private parseObject(): QmlNode {
    const typeTok = this.consume();
    if (!typeTok || typeTok.kind !== "ident") {
      throw new Error(`Expected type identifier, got ${JSON.stringify(typeTok)}`);
    }
    const type = typeTok.value;

    const lbrace = this.consume();
    if (!lbrace || lbrace.kind !== "lbrace") {
      throw new Error(`Expected '{' after type '${type}', got ${JSON.stringify(lbrace)}`);
    }

    const props: Record<string, string | number> = {};
    const children: QmlNode[] = [];

    while (true) {
      const next = this.peek();
      if (!next) throw new Error(`Unexpected end of input inside '${type}' block`);

      if (next.kind === "rbrace") {
        this.consume();
        break;
      }

      if (next.kind === "ident") {
        // Could be a property assignment or a child object
        const saved = this.pos;
        this.skipNewlinesSemicolons();
        const identTok = this.tokens[this.pos++] as { kind: "ident"; value: string };

        // Look ahead to see colon vs lbrace
        this.skipNewlinesSemicolons();
        const after = this.tokens[this.pos];

        if (after && after.kind === "colon") {
          // Property assignment
          this.pos++; // consume colon
          this.skipNewlinesSemicolons();
          const valTok = this.tokens[this.pos++];
          if (!valTok) throw new Error(`Expected value after '${identTok.value}:'`);

          if (valTok.kind === "string") {
            props[identTok.value] = valTok.value;
          } else if (valTok.kind === "number") {
            props[identTok.value] = valTok.value;
          } else if (valTok.kind === "ident") {
            props[identTok.value] = valTok.value;
          } else {
            throw new Error(`Unexpected value token for '${identTok.value}': ${JSON.stringify(valTok)}`);
          }
        } else if (after && after.kind === "lbrace") {
          // Child object — rewind and parse as object
          this.pos = saved;
          children.push(this.parseObject());
        } else {
          throw new Error(
            `Unexpected token after identifier '${identTok.value}': ${JSON.stringify(after)}`
          );
        }
      } else {
        throw new Error(`Unexpected token in object body: ${JSON.stringify(next)}`);
      }
    }

    return { type, props, children };
  }
}

export function parseQml(source: string): QmlNode {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  return parser.parseFile();
}
