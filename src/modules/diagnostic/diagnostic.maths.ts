import { randomInt } from "node:crypto";
import { AppError } from "../../utils/AppError/index.js";
import type { QuestionInput } from "./diagnostic.schemas.js";

// A free, built-in question writer for Maths. Every question is built from a random sum that the
// computer works out itself, so the correct answer is always right. No internet or API key is needed.
// Each wrong answer is a common mistake, and says which mistake it is (shown on the student's results).

type Level = QuestionInput["level"];
type Tier = "Foundation" | "Higher";

/** A question without its subject (the caller adds that). */
export type GeneratedQuestion = Omit<QuestionInput, "subjectId">;

/** A wrong answer, and the mistake that leads to it. */
interface Wrong {
  text: string;
  why?: string;
}

interface Made {
  question: string;
  correct: string;
  /** Plausible wrong answers. Extra ones are fine - three are picked. */
  wrongs: Wrong[];
}

interface Generator {
  topic: string;
  /** 1 = easiest. Questions in a set are ordered from easy to hard. */
  difficulty: 1 | 2 | 3;
  levels: Level[];
  tiers: Tier[];
  make: () => Made;
}

const SCHOOL: Level[] = ["GCSE", "IGCSE / O-level"];
const ALL: Level[] = [...SCHOOL, "A-level"];
const BOTH: Tier[] = ["Foundation", "Higher"];

// ---- small helpers -------------------------------------------------------------------------

const ri = (a: number, b: number) => randomInt(a, b + 1); // whole number from a to b, both included
const pick = <T>(xs: T[]) => xs[randomInt(xs.length)];
const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));

function shuffle<T>(items: T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const m = (latex: string) => `$${latex}$`; // maths between dollar signs
/** A wrong answer with the mistake it shows. */
const w = (text: string, why?: string): Wrong => ({ text, why });
/** A fraction in lowest terms, e.g. frac(6, 8) -> $\frac{3}{4}$ */
const frac = (n: number, d: number) => {
  const g = gcd(n, d);
  const [a, b] = [n / g, d / g];
  return b === 1 ? m(String(a)) : m(`\\frac{${a}}{${b}}`);
};
/** A fraction exactly as given (used for wrong answers such as 4/10). */
const rawFrac = (n: number, d: number) => m(`\\frac{${n}}{${d}}`);
/** c x^p written neatly: 3x^{2}, 5x, x, 7 */
const power = (c: number, p: number) => {
  if (p === 0) return `${c}`;
  const coefficient = c === 1 ? "" : String(c);
  return p === 1 ? `${coefficient}x` : `${coefficient}x^{${p}}`;
};
/** Adds a sign: 5 -> "+ 5", -5 -> "- 5" */
const plus = (n: number) => (n >= 0 ? `+ ${n}` : `- ${Math.abs(n)}`);

/** Three different wrong whole numbers: the likely mistakes first, then numbers close to the answer. */
function wrongNumbers(answer: number, mistakes: [number, string?][], format: (n: number) => string = String): Wrong[] {
  const out: { n: number; why?: string }[] = [];
  const add = (n: number, why?: string) => {
    if (Number.isInteger(n) && n > 0 && n !== answer && !out.some((o) => o.n === n)) out.push({ n, why });
  };
  shuffle(mistakes).forEach(([n, why]) => add(n, why));
  for (let k = 1; out.length < 3; k++) {
    add(answer + k);
    add(answer - k);
  }
  return out.slice(0, 3).map((o) => w(format(o.n), o.why));
}

// ---- the question types ---------------------------------------------------------------------

const GENERATORS: Generator[] = [
  // Fractions
  {
    topic: "Fractions", difficulty: 1, levels: SCHOOL, tiers: BOTH,
    make: () => {
      const b = ri(2, 8), a = ri(1, b - 1), k = ri(2, 9), amount = b * k, answer = a * k;
      return {
        question: `Work out ${m(`\\frac{${a}}{${b}}`)} of ${amount}`,
        correct: String(answer),
        wrongs: wrongNumbers(answer, [[k, "finding one part but not multiplying by the top number"], [amount - answer, "finding the part that is left over"], [a * b], [answer + k]]),
      };
    },
  },
  {
    topic: "Fractions", difficulty: 2, levels: SCHOOL, tiers: BOTH,
    make: () => {
      let b = ri(2, 9), d = ri(2, 9);
      while (d === b) d = ri(2, 9);
      const a = ri(1, b - 1), c = ri(1, d - 1);
      return {
        question: `Work out ${m(`\\frac{${a}}{${b}} + \\frac{${c}}{${d}}`)}`,
        correct: frac(a * d + c * b, b * d),
        wrongs: [
          w(rawFrac(a + c, b + d), "adding the tops and adding the bottoms"),
          w(rawFrac(a + c, b * d), "adding the tops without changing them to a common denominator"),
          w(rawFrac(a * c, b * d), "multiplying instead of adding"),
          w(rawFrac(a * d + c * b, b + d), "adding the bottoms instead of multiplying them"),
        ],
      };
    },
  },
  {
    topic: "Fractions", difficulty: 2, levels: SCHOOL, tiers: BOTH,
    make: () => {
      const b = ri(2, 9), d = ri(2, 9), a = ri(1, b - 1), c = ri(1, d - 1);
      return {
        question: `Work out ${m(`\\frac{${a}}{${b}} \\times \\frac{${c}}{${d}}`)}`,
        correct: frac(a * c, b * d),
        wrongs: [
          w(frac(a * d, b * c), "dividing instead of multiplying"),
          w(rawFrac(a + c, b + d), "adding the tops and adding the bottoms"),
          w(rawFrac(a * c, b + d), "multiplying the tops but adding the bottoms"),
          w(rawFrac(a + c, b * d), "adding the tops but multiplying the bottoms"),
        ],
      };
    },
  },
  // Percentages
  {
    topic: "Percentages", difficulty: 1, levels: SCHOOL, tiers: BOTH,
    make: () => {
      const p = pick([5, 10, 15, 20, 25, 30, 40, 60, 75]), n = 20 * ri(2, 15), answer = (n * p) / 100;
      return {
        question: `What is ${m(`${p}\\%`)} of ${n}?`,
        correct: String(answer),
        wrongs: wrongNumbers(answer, [[n - answer, "finding the percentage that is left"], [answer * 10, "putting the decimal point in the wrong place"], [p], [answer + p]]),
      };
    },
  },
  {
    topic: "Percentages", difficulty: 2, levels: SCHOOL, tiers: BOTH,
    make: () => {
      const p = pick([5, 10, 15, 20, 25, 30]), n = 20 * ri(2, 15), answer = n + (n * p) / 100;
      return {
        question: `Increase £${n} by ${m(`${p}\\%`)}`,
        correct: `£${answer}`,
        wrongs: wrongNumbers(
          answer,
          [[n + p, "adding the percentage as a plain number"], [(n * p) / 100, "finding the increase but not adding it on"], [n - (n * p) / 100, "decreasing instead of increasing"]],
          (v) => `£${v}`
        ),
      };
    },
  },
  // Number
  {
    topic: "Number", difficulty: 1, levels: SCHOOL, tiers: BOTH,
    make: () => {
      const a = ri(2, 9), b = ri(2, 9), c = ri(2, 9), answer = a + b * c;
      return {
        question: `Work out ${m(`${a} + ${b} \\times ${c}`)}`,
        correct: String(answer),
        wrongs: wrongNumbers(answer, [[(a + b) * c, "adding before multiplying (ignoring the order of operations)"], [a * b + c, "multiplying the wrong pair of numbers"], [a + b + c, "adding everything"]]),
      };
    },
  },
  {
    topic: "Number", difficulty: 2, levels: SCHOOL, tiers: BOTH,
    make: () => {
      let a = ri(2, 9), b = ri(2, 9);
      while (a === b || gcd(a, b) !== 1) { a = ri(2, 9); b = ri(2, 9); }
      const g = ri(2, 6), x = g * a, y = g * b;
      return {
        question: `What is the highest common factor (HCF) of ${x} and ${y}?`,
        correct: String(g),
        wrongs: wrongNumbers(g, [[g * a * b, "finding the lowest common multiple instead of the highest common factor"], [g * 2], [a * b], [Math.abs(x - y), "subtracting the two numbers"]]),
      };
    },
  },
  {
    topic: "Number", difficulty: 2, levels: SCHOOL, tiers: BOTH,
    make: () => {
      let a = ri(2, 9), b = ri(2, 9);
      while (a === b || gcd(a, b) !== 1) { a = ri(2, 9); b = ri(2, 9); }
      const g = ri(2, 5), x = g * a, y = g * b, answer = g * a * b;
      return {
        question: `What is the lowest common multiple (LCM) of ${x} and ${y}?`,
        correct: String(answer),
        wrongs: wrongNumbers(answer, [[x * y, "multiplying the two numbers instead of finding the lowest common multiple"], [g, "finding the highest common factor instead of the lowest common multiple"], [a * b], [answer + g]]),
      };
    },
  },
  // Ratio
  {
    topic: "Ratio", difficulty: 2, levels: SCHOOL, tiers: BOTH,
    make: () => {
      let a = ri(1, 5), b = ri(1, 5);
      while (a === b) b = ri(1, 5);
      const k = ri(2, 9), total = k * (a + b), answer = k * Math.max(a, b);
      return {
        question: `Share £${total} in the ratio ${a} : ${b}. How much is the larger share?`,
        correct: `£${answer}`,
        wrongs: wrongNumbers(
          answer,
          [[k * Math.min(a, b), "finding the smaller share"], [total / 2, "sharing the amount equally"], [answer + k], [answer - k]],
          (v) => `£${v}`
        ),
      };
    },
  },
  // Algebra
  {
    topic: "Algebra", difficulty: 2, levels: SCHOOL, tiers: BOTH,
    make: () => {
      const x = ri(2, 9), a = ri(2, 9), b = ri(1, 15), c = a * x + b;
      return {
        question: `Solve ${m(`${a}x + ${b} = ${c}`)}`,
        correct: m(`x = ${x}`),
        wrongs: wrongNumbers(x, [[c - b, "forgetting to divide by the number in front of x"], [c + b, "adding instead of subtracting"], [(c + b) / a, "adding instead of subtracting"], [a]], (v) => m(`x = ${v}`)),
      };
    },
  },
  {
    topic: "Algebra", difficulty: 1, levels: SCHOOL, tiers: BOTH,
    make: () => {
      const a = ri(2, 9), b = ri(1, 9);
      return {
        question: `Expand ${m(`${a}(x + ${b})`)}`,
        correct: m(`${a}x + ${a * b}`),
        wrongs: [
          w(m(`${a}x + ${b}`), "not multiplying the second term by the number outside the bracket"),
          w(m(`x + ${a * b}`), "not multiplying the first term by the number outside the bracket"),
          w(m(`${a}x + ${a + b}`), "adding instead of multiplying"),
          w(m(`${a + b}x`), "adding everything together"),
        ],
      };
    },
  },
  {
    topic: "Algebra", difficulty: 3, levels: ALL, tiers: ["Higher"],
    make: () => {
      const p = ri(1, 9), q = ri(1, 9);
      return {
        question: `Expand and simplify ${m(`(x + ${p})(x + ${q})`)}`,
        correct: m(`x^{2} + ${p + q}x + ${p * q}`),
        wrongs: [
          w(m(`x^{2} + ${p * q}`), "missing out the middle term"),
          w(m(`x^{2} + ${p + q}x + ${p + q}`), "adding instead of multiplying the last terms"),
          w(m(`x^{2} + ${p + q}`), "missing out the x term and the last term"),
          w(m(`2x + ${p + q}`), "adding the brackets instead of multiplying"),
        ],
      };
    },
  },
  // Quadratics
  {
    topic: "Quadratics", difficulty: 3, levels: ALL, tiers: ["Higher"],
    make: () => {
      let p = ri(1, 9), q = ri(1, 9);
      while (p === q) q = ri(1, 9);
      return {
        question: `Factorise ${m(`x^{2} + ${p + q}x + ${p * q}`)}`,
        correct: m(`(x + ${p})(x + ${q})`),
        wrongs: [
          w(m(`(x - ${p})(x - ${q})`), "getting the signs wrong"),
          w(m(`(x + ${p})(x - ${q})`), "getting one of the signs wrong"),
          w(m(`(x + ${p + q})(x + 1)`), "using the middle number as one of the factors"),
          w(m(`(x + ${p * q})(x + 1)`), "using the last number as one of the factors"),
        ],
      };
    },
  },
  {
    topic: "Quadratics", difficulty: 3, levels: ALL, tiers: ["Higher"],
    make: () => {
      let p = ri(1, 9), q = ri(1, 9);
      while (p === q) q = ri(1, 9);
      [p, q] = [Math.min(p, q), Math.max(p, q)];
      return {
        question: `Solve ${m(`x^{2} - ${p + q}x + ${p * q} = 0`)}`,
        correct: `${m(`x = ${p}`)} or ${m(`x = ${q}`)}`,
        wrongs: [
          w(`${m(`x = -${p}`)} or ${m(`x = -${q}`)}`, "forgetting that the signs change when solving"),
          w(`${m(`x = ${p}`)} or ${m(`x = -${q}`)}`, "getting one of the signs wrong"),
          w(`${m(`x = ${p + q}`)} or ${m(`x = ${p * q}`)}`, "using the numbers in the equation as the answers"),
          w(`${m(`x = -${p}`)} or ${m(`x = ${q}`)}`, "getting one of the signs wrong"),
        ],
      };
    },
  },
  // Indices
  {
    topic: "Indices", difficulty: 2, levels: ALL, tiers: ["Higher"],
    make: () => {
      let a = ri(2, 8), b = ri(2, 8);
      while (a === b) b = ri(2, 8);
      return {
        question: `Simplify ${m(`x^{${a}} \\times x^{${b}}`)}`,
        correct: m(`x^{${a + b}}`),
        wrongs: [
          w(m(`x^{${a * b}}`), "multiplying the powers instead of adding them"),
          w(m(`x^{${Math.abs(a - b)}}`), "subtracting the powers instead of adding them"),
          w(m(`2x^{${a + b}}`), "adding the x terms as well as the powers"),
          w(m(`x^{${a + b + 1}}`)),
        ],
      };
    },
  },
  {
    topic: "Indices", difficulty: 3, levels: ALL, tiers: ["Higher"],
    make: () => {
      let a = ri(2, 6), b = ri(2, 6);
      while (a === b) b = ri(2, 6);
      return {
        question: `Simplify ${m(`(x^{${a}})^{${b}}`)}`,
        correct: m(`x^{${a * b}}`),
        wrongs: [
          w(m(`x^{${a + b}}`), "adding the powers instead of multiplying them"),
          w(m(`${b}x^{${a}}`), "turning the outer power into a number in front"),
          w(m(`x^{${a * b + 1}}`)),
          w(m(`${a}x^{${b}}`), "swapping the powers and putting one in front"),
        ],
      };
    },
  },
  // Geometry
  {
    topic: "Geometry", difficulty: 1, levels: SCHOOL, tiers: BOTH,
    make: () => {
      const a = ri(30, 80), b = ri(30, 80), answer = 180 - a - b;
      return {
        question: `Two angles in a triangle are ${a}° and ${b}°. What is the third angle?`,
        correct: `${answer}°`,
        wrongs: wrongNumbers(answer, [[a + b, "adding the two angles and stopping there"], [360 - a - b, "using 360° instead of 180°"], [180 - a], [180 - b]], (v) => `${v}°`),
      };
    },
  },
  {
    topic: "Geometry", difficulty: 2, levels: SCHOOL, tiers: BOTH,
    make: () => {
      const base = 2 * ri(2, 10), h = ri(3, 15), area = (base * h) / 2;
      return {
        question: `A triangle has a base of ${base} cm and a perpendicular height of ${h} cm. What is its area?`,
        correct: `${area} cm²`,
        wrongs: wrongNumbers(area, [[base * h, "forgetting to halve"], [base + h, "adding the base and the height"], [area + base], [area - h]], (v) => `${v} cm²`),
      };
    },
  },
  {
    topic: "Geometry", difficulty: 3, levels: SCHOOL, tiers: ["Higher"],
    make: () => {
      const r = ri(2, 9);
      const fmt = (n: number) => `${m(`${n}\\pi`)} cm²`;
      return {
        question: `A circle has a radius of ${r} cm. What is its area? Leave your answer in terms of ${m("\\pi")}.`,
        correct: fmt(r * r),
        wrongs: [
          w(fmt(2 * r), "using the circumference formula"),
          w(fmt(r), "forgetting to square the radius"),
          w(fmt(2 * r * r), "using 2 times the radius squared"),
          w(fmt(r * r + r)),
        ],
      };
    },
  },
  {
    topic: "Geometry", difficulty: 3, levels: SCHOOL, tiers: BOTH,
    make: () => {
      const [a, b, c] = pick([[3, 4, 5], [6, 8, 10], [5, 12, 13], [9, 12, 15], [8, 15, 17]]);
      return {
        question: `A right-angled triangle has shorter sides of ${a} cm and ${b} cm. How long is the hypotenuse?`,
        correct: `${c} cm`,
        wrongs: wrongNumbers(c, [[a + b, "adding the sides instead of the squares"], [c + 2], [c - 1], [(a * b) / 2]], (v) => `${v} cm`),
      };
    },
  },
  // Coordinates
  {
    topic: "Coordinates", difficulty: 2, levels: ALL, tiers: BOTH,
    make: () => {
      const x1 = ri(0, 4), y1 = ri(0, 6), d = ri(1, 4), g = ri(2, 6);
      return {
        question: `Find the gradient of the line through ${m(`(${x1}, ${y1})`)} and ${m(`(${x1 + d}, ${y1 + g * d})`)}`,
        correct: String(g),
        wrongs: wrongNumbers(g, [[d, "using only the change across"], [g * d, "using only the change up"], [g + 1], [g - 1]]),
      };
    },
  },
  // Statistics
  {
    topic: "Statistics", difficulty: 1, levels: SCHOOL, tiers: BOTH,
    make: () => {
      const nums = [ri(2, 20), ri(2, 20), ri(2, 20), ri(2, 20)];
      const s = nums.reduce((t, n) => t + n, 0);
      nums.push((5 - (s % 5)) + 5 * ri(0, 2)); // makes the total divisible by 5
      const total = nums.reduce((t, n) => t + n, 0), mean = total / 5, sorted = [...nums].sort((x, y) => x - y);
      return {
        question: `Work out the mean of these numbers: ${nums.join(", ")}`,
        correct: String(mean),
        wrongs: wrongNumbers(mean, [[sorted[2], "finding the median instead of the mean"], [sorted[4] - sorted[0], "finding the range instead of the mean"], [mean + 1], [total, "forgetting to divide by how many numbers there are"]]),
      };
    },
  },
  {
    topic: "Statistics", difficulty: 2, levels: SCHOOL, tiers: BOTH,
    make: () => {
      const set = new Set<number>();
      while (set.size < 5) set.add(ri(3, 30));
      const nums = shuffle([...set]), sorted = [...nums].sort((x, y) => x - y);
      const mean = Math.round(nums.reduce((t, n) => t + n, 0) / 5);
      return {
        question: `Find the median of these numbers: ${nums.join(", ")}`,
        correct: String(sorted[2]),
        wrongs: wrongNumbers(sorted[2], [[nums[2], "not putting the numbers in order first"], [mean, "finding the mean instead of the median"], [sorted[4]], [sorted[4] - sorted[0], "finding the range instead of the median"]]),
      };
    },
  },
  // Probability
  {
    topic: "Probability", difficulty: 2, levels: SCHOOL, tiers: BOTH,
    make: () => {
      const red = ri(2, 7), blue = ri(2, 8);
      return {
        question: `A bag has ${red} red counters and ${blue} blue counters. What is the probability of picking a red counter at random?`,
        correct: frac(red, red + blue),
        wrongs: [
          w(frac(red, blue), "comparing red to blue instead of red to the total"),
          w(frac(blue, red + blue), "finding the probability of blue instead of red"),
          w(frac(1, red)),
          w(rawFrac(red, red + blue + 1)),
        ],
      };
    },
  },
  // Sequences
  {
    topic: "Sequences", difficulty: 2, levels: ALL, tiers: BOTH,
    make: () => {
      const d = ri(2, 7), a = ri(3, 12), e = a - d;
      const nth = (c: number, k: number) => (k === 0 ? `${c}n` : `${c}n ${plus(k)}`);
      return {
        question: `The first three terms of a sequence are ${a}, ${a + d}, ${a + 2 * d}. What is the nth term?`,
        correct: nth(d, e),
        wrongs: [
          w(nth(d, a), "using the first term as the number added on"),
          w(nth(a, d), "swapping the first term and the difference"),
          w(nth(d, -e), "getting the sign of the number added on wrong"),
          w(nth(d + 1, e)),
          w(nth(1, d)),
        ],
      };
    },
  },
  // Calculus (A-level)
  {
    topic: "Calculus", difficulty: 3, levels: ["A-level"], tiers: BOTH,
    make: () => {
      const a = ri(2, 9), n = ri(2, 6);
      return {
        question: `Differentiate ${m(power(a, n))} with respect to ${m("x")}`,
        correct: m(power(a * n, n - 1)),
        wrongs: [
          w(m(power(a, n - 1)), "forgetting to multiply by the power"),
          w(m(power(a * n, n)), "not reducing the power by one"),
          w(m(power(a * (n - 1), n - 1)), "multiplying by one less than the power"),
          w(m(power(n, n - 1)), "dropping the number in front"),
        ],
      };
    },
  },
  {
    topic: "Calculus", difficulty: 3, levels: ["A-level"], tiers: BOTH,
    make: () => {
      const n = ri(1, 5), k = ri(1, 5), a = (n + 1) * k;
      return {
        question: `Find ${m(`\\int ${power(a, n)} \\, dx`)}`,
        correct: m(`${power(k, n + 1)} + c`),
        wrongs: [
          w(m(`${power(a, n + 1)} + c`), "forgetting to divide by the new power"),
          w(m(`${power(a * n, n - 1)} + c`), "differentiating instead of integrating"),
          w(m(power(k, n + 1)), "forgetting the constant of integration"),
          w(m(`${power(k, n)} + c`), "not increasing the power by one"),
        ],
      };
    },
  },
  // Logarithms (A-level)
  {
    topic: "Logarithms", difficulty: 3, levels: ["A-level"], tiers: BOTH,
    make: () => {
      const base = pick([2, 3, 5]), k = ri(2, 5), n = base ** k;
      return {
        question: `Evaluate ${m(`\\log_{${base}} ${n}`)}`,
        correct: String(k),
        wrongs: wrongNumbers(k, [[n / base, "dividing the number by the base"], [k + 1], [k - 1], [base * k, "multiplying the base by the power"]]),
      };
    },
  },
];

// ---- using them ------------------------------------------------------------------------------

/** Does this subject name mean Maths? Only Maths has a built-in generator. */
export const isMaths = (subjectName: string) => /math/i.test(subjectName);

const forLevelAndTier = (level: Level, tier: QuestionInput["tier"]) =>
  GENERATORS.filter((g) => g.levels.includes(level) && (tier === "Any" || g.tiers.includes(tier)));

/** The topics the built-in generator can write, with the levels and tiers each one is available for. */
export function topicCatalog() {
  const map = new Map<string, { topic: string; levels: Level[]; tiers: Tier[] }>();
  for (const g of GENERATORS) {
    const entry = map.get(g.topic) ?? { topic: g.topic, levels: [], tiers: [] };
    for (const l of g.levels) if (!entry.levels.includes(l)) entry.levels.push(l);
    for (const t of g.tiers) if (!entry.tiers.includes(t)) entry.tiers.push(t);
    map.set(g.topic, entry);
  }
  return [...map.values()];
}

interface Request {
  level: Level;
  tier: QuestionInput["tier"];
  /** Empty = every topic. */
  topic?: string;
  count: number;
  /** Questions that already exist, so none are repeated. */
  existing: string[];
}

/** Writes `count` different Maths questions, easiest first. */
export function generateMathsQuestions(r: Request): GeneratedQuestion[] {
  let pool = forLevelAndTier(r.level, r.tier);
  if (pool.length === 0) throw new AppError(400, "There are no built-in questions for that level and tier.");
  if (r.topic) {
    const wanted = r.topic.trim().toLowerCase();
    pool = pool.filter((g) => g.topic.toLowerCase() === wanted);
    if (pool.length === 0) {
      const available = [...new Set(forLevelAndTier(r.level, r.tier).map((g) => g.topic))].join(", ");
      throw new AppError(400, `No built-in topic called "${r.topic}" for that level and tier. Topics you can use: ${available}.`);
    }
  }

  const seen = new Set(r.existing.map((q) => q.trim()));
  const made: { difficulty: number; question: GeneratedQuestion }[] = [];
  let turn = 0;
  for (let attempts = 0; made.length < r.count && attempts < r.count * 40; attempts++) {
    // Take the question types in turn (in a random order) so the topics are mixed.
    if (turn % pool.length === 0) pool = shuffle(pool);
    const g = pool[turn++ % pool.length];
    const { question, correct, wrongs } = g.make();
    if (seen.has(question)) continue; // already exists, or already made in this set
    const distinct: Wrong[] = [];
    for (const x of wrongs) if (x.text !== correct && !distinct.some((d) => d.text === x.text)) distinct.push(x);
    if (distinct.length < 3) continue;
    seen.add(question);
    const options = shuffle([
      { text: correct, isCorrect: true, misconception: undefined as string | undefined },
      ...shuffle(distinct).slice(0, 3).map((x) => ({ text: x.text, isCorrect: false, misconception: x.why })),
    ]);
    made.push({ difficulty: g.difficulty, question: { level: r.level, tier: r.tier, topic: g.topic, question, options } });
  }
  if (made.length === 0) throw new AppError(409, "Could not make any new questions: the existing ones already cover everything this generator can write.");
  return made.sort((a, b) => a.difficulty - b.difficulty).map((x) => x.question);
}
