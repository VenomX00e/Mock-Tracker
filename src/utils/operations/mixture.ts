import { ASTNode, Question } from "../mathTypes";
import { DifficultyLevel, OperationSettings } from "../../store/speedMathStore";
import { getRandomInt } from "../mathUtils";

const fractionMappers = [
  { text: "50%", d: 2, n: 1 },
  { text: "25%", d: 4, n: 1 },
  { text: "75%", d: 4, n: 3 },
  { text: "20%", d: 5, n: 1 },
  { text: "40%", d: 5, n: 2 },
  { text: "60%", d: 5, n: 3 },
  { text: "80%", d: 5, n: 4 },
  { text: "16.66%", d: 6, n: 1 },
  { text: "83.33%", d: 6, n: 5 },
  { text: "12.5%", d: 8, n: 1 },
  { text: "37.5%", d: 8, n: 3 },
  { text: "62.5%", d: 8, n: 5 },
  { text: "87.5%", d: 8, n: 7 },
  { text: "33.33%", d: 3, n: 1 },
  { text: "66.66%", d: 3, n: 2 },
];

function getFactors(n: number): number[] {
  const factors = [];
  for (let i = 1; i <= n; i++) {
    if (n % i === 0) factors.push(i);
  }
  return factors;
}

export function generateAbstractTree(
  numOperators: number,
  difficulty: DifficultyLevel,
  targetValue: number,
): ASTNode {
  if (numOperators <= 0) {
    return { type: "number", value: targetValue };
  }

  const allowedOps = ["+", "-"];

  const factors = getFactors(targetValue).filter(
    (f) => f > 1 && f < targetValue && f <= 12 && targetValue / f <= 12,
  );
  if (factors.length > 0) allowedOps.push("*");

  // a / b = target => a = target * b. Need a <= 144
  const maxA = 144;
  const maxB = Math.floor(maxA / targetValue);
  if (maxB >= 2) allowedOps.push("/");

  const op = allowedOps[Math.floor(Math.random() * allowedOps.length)];

  let leftTarget = 0,
    rightTarget = 0;

  if (op === "+") {
    leftTarget = getRandomInt(1, Math.max(1, targetValue - 1));
    rightTarget = targetValue - leftTarget;
  } else if (op === "-") {
    const maxRight = Math.max(1, 99 - targetValue);
    rightTarget = getRandomInt(1, maxRight);
    leftTarget = targetValue + rightTarget;
  } else if (op === "*") {
    leftTarget = factors[Math.floor(Math.random() * factors.length)];
    rightTarget = targetValue / leftTarget;
  } else if (op === "/") {
    rightTarget = getRandomInt(2, maxB);
    leftTarget = targetValue * rightTarget;
  }

  const leftOps = Math.floor(Math.random() * numOperators); // 0 to numOps - 1
  const rightOps = numOperators - 1 - leftOps;

  return {
    type: "operation",
    operator: op as "+" | "-" | "*" | "/",
    left: generateAbstractTree(leftOps, difficulty, leftTarget),
    right: generateAbstractTree(rightOps, difficulty, rightTarget),
  };
}

export function mutateLeafNodes(
  node: ASTNode,
  difficulty: DifficultyLevel,
  settings?: OperationSettings,
) {
  if (node.type === "operation") {
    if (node.left) mutateLeafNodes(node.left, difficulty, settings);
    if (node.right) mutateLeafNodes(node.right, difficulty, settings);
  } else {
    const val = node.value!;

    let mutateProb = 0;
    switch (difficulty) {
      case "BEGINNER":
        mutateProb = 0.0;
        break;
      case "EASY":
        mutateProb = 0.1;
        break;
      case "MEDIUM":
        mutateProb = 0.2;
        break;
      case "HARD":
        mutateProb = 0.35;
        break;
      case "CHALLENGING":
        mutateProb = 0.5;
        break;
      case "EXPERT":
        mutateProb = 0.65;
        break;
    }

    if (Math.random() < mutateProb) {
      const options = [];

      const includeRoots = settings?.mixIncludesRoots ?? true;
      const includeFractions = settings?.mixIncludesFractions ?? true;
      const includePowers = settings?.mixIncludesPowers ?? true;

      if (includeRoots) {
        if (val >= 2 && val <= 15) {
          options.push(() => {
            node.displayFormat = `sqrt(${val * val})`;
          });
        }
        if (val >= 2 && val <= 10) {
          options.push(() => {
            node.displayFormat = `cbrt(${val * val * val})`;
          });
        }
      }

      if (includeFractions) {
        const validPercs = fractionMappers.filter(
          (m) => val % m.n === 0 && (val / m.n) * m.d <= 200,
        );
        if (validPercs.length > 0) {
          options.push(() => {
            const opt =
              validPercs[Math.floor(Math.random() * validPercs.length)];
            const base = (val / opt.n) * opt.d;
            node.displayFormat = `${opt.text} of ${base}`;
          });
        }
      }

      if (includePowers) {
        const powerFormats: Record<number, string> = {
          8: "2^3",
          16: "2^4",
          27: "3^3",
          32: "2^5",
          64: "2^6",
          12: "2^2 × 3",
          24: "2^3 × 3",
          18: "3^2 × 2",
          36: "6^2",
          49: "7^2",
          81: "9^2",
        };
        if (powerFormats[val]) {
          options.push(() => {
            node.displayFormat = powerFormats[val];
          });
        }
      }

      if (options.length > 0) {
        const choice = options[Math.floor(Math.random() * options.length)];
        choice();
      }
    }
  }
}

const precedence = {
  "+": 1,
  "-": 1,
  "*": 2,
  "/": 2,
};

function stringifyHelper(
  node: ASTNode,
  parentPrecedence: number,
  bracketDepth: number,
): { str: string; deepestDepth: number } {
  if (node.type === "number") {
    return {
      str: node.displayFormat || node.value!.toString(),
      deepestDepth: bracketDepth,
    };
  }

  const op = node.operator!;
  const prec = precedence[op];

  const requiresBracket = prec < parentPrecedence;
  const currentBracketDepth = requiresBracket ? bracketDepth + 1 : bracketDepth;

  const left = stringifyHelper(node.left!, prec, currentBracketDepth);
  const right = stringifyHelper(node.right!, prec + 0.1, currentBracketDepth); // +0.1 to force brackets for right side of non-associative ops like a / (b / c)

  let expr = `${left.str} ${op === "*" ? "×" : op === "/" ? "÷" : op} ${right.str}`;

  if (requiresBracket) {
    if (currentBracketDepth % 2 === 1) {
      expr = `(${expr})`;
    } else {
      expr = `[${expr}]`;
    }
  }
  return {
    str: expr,
    deepestDepth: Math.max(left.deepestDepth, right.deepestDepth),
  };
}

export function stringifyTree(node: ASTNode): string {
  return stringifyHelper(node, 0, 0).str;
}

export function generateMixture(
  settings?: OperationSettings,
): Omit<Question, "operation"> {
  const difficulty = settings?.difficulty || "BEGINNER";
  let numOps = 3;
  switch (difficulty) {
    case "BEGINNER":
    case "EASY":
      numOps = 3;
      break;
    case "MEDIUM":
    case "HARD":
      numOps = 4;
      break;
    case "CHALLENGING":
    case "EXPERT":
      numOps = 5;
      break;
  }

  const targetValue = getRandomInt(5, 50);
  const ast = generateAbstractTree(numOps, difficulty, targetValue);

  mutateLeafNodes(ast, difficulty, settings);
  const displayStr = stringifyTree(ast);

  return {
    id: Math.random().toString(36).substring(7),
    num1: targetValue,
    displayString: displayStr,
    correctAnswer: targetValue,
  };
}
