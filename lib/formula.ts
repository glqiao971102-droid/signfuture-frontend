/**
 * Safe arithmetic expression evaluator for the admin product editor's live
 * price preview.
 *
 * Mirrors the backend `app/services/formula.ts` exactly, so the preview shown
 * while editing matches what the server computes and stores. No eval()/Function
 * — a hand-written recursive-descent parser over numbers, named variables,
 * + - * / %, parentheses, unary minus, and a small set of maths functions.
 */

const FUNCTIONS: Record<string, (...args: number[]) => number> = {
  min: Math.min,
  max: Math.max,
  ceil: Math.ceil,
  floor: Math.floor,
  round: Math.round,
  abs: Math.abs,
  sqrt: Math.sqrt,
  pow: Math.pow,
};

type Token =
  | { t: "num"; v: number }
  | { t: "id"; v: string }
  | { t: "op"; v: string }
  | { t: "paren"; v: "(" | ")" }
  | { t: "comma" };

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < input.length) {
    const c = input[i];
    if (c === " " || c === "\t" || c === "\n") {
      i++;
      continue;
    }
    if (c >= "0" && c <= "9") {
      let num = "";
      while (i < input.length && /[0-9.]/.test(input[i])) num += input[i++];
      tokens.push({ t: "num", v: Number(num) });
      continue;
    }
    if (/[a-zA-Z_]/.test(c)) {
      let id = "";
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) id += input[i++];
      tokens.push({ t: "id", v: id });
      continue;
    }
    if ("+-*/%".includes(c)) {
      tokens.push({ t: "op", v: c });
      i++;
      continue;
    }
    if (c === "(" || c === ")") {
      tokens.push({ t: "paren", v: c });
      i++;
      continue;
    }
    if (c === ",") {
      tokens.push({ t: "comma" });
      i++;
      continue;
    }
    throw new Error(`Unexpected character "${c}"`);
  }
  return tokens;
}

export function evaluateFormula(expr: string, scope: Record<string, number>): number {
  const tokens = tokenize(expr);
  let pos = 0;
  const peek = () => tokens[pos];
  const next = () => tokens[pos++];

  function parseExpression(): number {
    let value = parseTerm();
    for (;;) {
      const p = peek();
      if (p && p.t === "op" && p.v === "+") {
        next();
        value += parseTerm();
      } else if (p && p.t === "op" && p.v === "-") {
        next();
        value -= parseTerm();
      } else break;
    }
    return value;
  }

  function parseTerm(): number {
    let value = parseFactor();
    for (;;) {
      const p = peek();
      if (p && p.t === "op" && p.v === "*") {
        next();
        value *= parseFactor();
      } else if (p && p.t === "op" && p.v === "/") {
        next();
        const d = parseFactor();
        if (d === 0) throw new Error("Division by zero");
        value /= d;
      } else if (p && p.t === "op" && p.v === "%") {
        next();
        value %= parseFactor();
      } else break;
    }
    return value;
  }

  function parseFactor(): number {
    const tok = peek();
    if (!tok) throw new Error("Unexpected end of formula");
    if (tok.t === "op" && tok.v === "-") {
      next();
      return -parseFactor();
    }
    if (tok.t === "op" && tok.v === "+") {
      next();
      return parseFactor();
    }
    if (tok.t === "num") {
      next();
      return tok.v;
    }
    if (tok.t === "paren" && tok.v === "(") {
      next();
      const v = parseExpression();
      const close = next();
      if (!close || close.t !== "paren" || close.v !== ")") throw new Error('Missing ")"');
      return v;
    }
    if (tok.t === "id") {
      next();
      if (peek() && peek().t === "paren" && (peek() as { v: string }).v === "(") {
        const fn = FUNCTIONS[tok.v];
        if (!fn) throw new Error(`Unknown function "${tok.v}"`);
        next();
        const args: number[] = [];
        if (!(peek() && peek().t === "paren" && (peek() as { v: string }).v === ")")) {
          args.push(parseExpression());
          while (peek() && peek().t === "comma") {
            next();
            args.push(parseExpression());
          }
        }
        const close = next();
        if (!close || close.t !== "paren" || close.v !== ")") throw new Error('Missing ")"');
        return fn(...args);
      }
      if (!(tok.v in scope)) throw new Error(`Unknown variable "${tok.v}"`);
      return scope[tok.v];
    }
    throw new Error("Unexpected token");
  }

  const result = parseExpression();
  if (pos !== tokens.length) throw new Error("Unexpected trailing tokens");
  if (!Number.isFinite(result)) throw new Error("Not a finite number");
  return result;
}

// ----- Product config types (mirror the backend model) -----

export type ProductInput = {
  key: string;
  label: string;
  type: "number" | "integer";
  min?: number;
  max?: number;
  default: number;
  unit?: string;
};

export type ProductChoice = { key: string; label: string; value: number };
export type ProductOption = { key: string; label: string; choices: ProductChoice[] };
export type ProductVariable = { key: string; expr: string };

export type ProductConfig = {
  inputs: ProductInput[];
  options: ProductOption[];
  constants: Record<string, number>;
  variables: ProductVariable[];
  formula: string;
  currency?: string;
};

/**
 * Prices a config from inputs + selections. Returns { price } or { error }.
 * Same algorithm as the backend `ProductPricing` service.
 */
export function priceConfig(
  config: ProductConfig,
  inputs: Record<string, number>,
  selections: Record<string, string>,
): { price: number } | { error: string } {
  try {
    const scope: Record<string, number> = {};

    for (const input of config.inputs) {
      const raw = inputs[input.key];
      scope[input.key] = Number.isFinite(raw) ? raw : input.default;
    }
    for (const option of config.options) {
      const choice =
        option.choices.find((c) => c.key === selections[option.key]) ?? option.choices[0];
      scope[option.key] = choice ? choice.value : 0;
    }
    for (const [name, value] of Object.entries(config.constants ?? {})) {
      scope[name] = value;
    }
    for (const variable of config.variables ?? []) {
      scope[variable.key] = evaluateFormula(variable.expr, scope);
    }

    return { price: evaluateFormula(config.formula, scope) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Invalid formula" };
  }
}
