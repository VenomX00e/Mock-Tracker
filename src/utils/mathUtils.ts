const numberPools: Record<string, number[]> = {};
const lastPopped: Record<string, number> = {};

export function fisherYatesShuffle<T>(array: T[]): T[] {
  let currentIndex = array.length, randomIndex;
  while (currentIndex !== 0) {
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;
    [array[currentIndex], array[randomIndex]] = [array[randomIndex], array[currentIndex]];
  }
  return array;
}

const tablePools: Record<string, {n1: number, n2: number}[]> = {};
const lastTablePopped: Record<string, {n1: number, n2: number}> = {};

export function getExhaustiveTableCombination(rangesStr: string): {n1: number, n2: number} {
  const key = `table_${rangesStr}`;
  if (!tablePools[key] || tablePools[key].length === 0) {
    const tableNumbers = parseCustomRanges(rangesStr);
    const combinations: {n1: number, n2: number}[] = [];
    for (const t of tableNumbers) {
      for (let m = 2; m <= 11; m++) {
        combinations.push({n1: t, n2: m});
      }
    }
    tablePools[key] = fisherYatesShuffle(combinations);

    if (tablePools[key].length > 1 && lastTablePopped[key]) {
      const last = lastTablePopped[key];
      const next = tablePools[key][tablePools[key].length - 1];
      if (last.n1 === next.n1 && last.n2 === next.n2) {
        // Swap last element with the first
        const temp = tablePools[key][tablePools[key].length - 1];
        tablePools[key][tablePools[key].length - 1] = tablePools[key][0];
        tablePools[key][0] = temp;
      }
    }
  }
  const val = tablePools[key].pop()!;
  lastTablePopped[key] = val;
  return val;
}

export function getExhaustiveRandomFromRanges(rangesStr: string, operationKey: string): number {
  const key = `${operationKey}_${rangesStr}`;
  if (!numberPools[key] || numberPools[key].length === 0) {
    const numbers = parseCustomRanges(rangesStr);
    numberPools[key] = fisherYatesShuffle(numbers);
    
    // Prevent the same number from being returned twice in a row when pool replenishes
    if (numberPools[key].length > 1 && lastPopped[key] !== undefined) {
      if (numberPools[key][numberPools[key].length - 1] === lastPopped[key]) {
        // Swap last element with the first
        const temp = numberPools[key][numberPools[key].length - 1];
        numberPools[key][numberPools[key].length - 1] = numberPools[key][0];
        numberPools[key][0] = temp;
      }
    }
  }
  const val = numberPools[key].pop()!;
  lastPopped[key] = val;
  return val;
}

export function parseCustomRanges(rangeStr: string): number[] {
  const result = new Set<number>();
  const parts = rangeStr.split(',').map(s => s.trim());
  
  for (const part of parts) {
    if (!part) continue;
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-');
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const min = Math.min(start, end);
        const max = Math.max(start, end);
        for (let i = min; i <= max; i++) {
          result.add(i);
        }
      }
    } else {
      const num = parseInt(part, 10);
      if (!isNaN(num)) {
        result.add(num);
      }
    }
  }
  
  const finalArray = Array.from(result).sort((a, b) => a - b);
  return finalArray.length > 0 ? finalArray : [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]; // fallback
}

export function getRandomFromRanges(rangesStr: string): number {
  const numbers = parseCustomRanges(rangesStr);
  return numbers[Math.floor(Math.random() * numbers.length)];
}

export function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate number with n digits
export function getNDigitNumber(digits: number): number {
  if (digits <= 1) return getRandomInt(1, 9);
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  return getRandomInt(min, max);
}

// Check if addition requires carry
export function hasCarry(a: number, b: number): boolean {
  let tempA = a, tempB = b;
  while (tempA > 0 || tempB > 0) {
    if ((tempA % 10) + (tempB % 10) >= 10) return true;
    tempA = Math.floor(tempA / 10);
    tempB = Math.floor(tempB / 10);
  }
  return false;
}

// Generate addition with specific carry constraints
export function getAdditionPair(digits1: number, digits2: number, allowCarry: boolean): [number, number] {
  let a, b;
  let attempts = 0;
  do {
    a = getNDigitNumber(digits1);
    b = getNDigitNumber(digits2);
    attempts++;
  } while (hasCarry(a, b) !== allowCarry && attempts < 50); // fallback after 50 attempts
  return Math.random() > 0.5 ? [a, b] : [b, a]; // randomize order
}

// Check if subtraction requires borrow
export function hasBorrow(a: number, b: number): boolean {
  if (a < b) return true; // Just in case, though we assure a >= b
  let tempA = a, tempB = b;
  while (tempA > 0 || tempB > 0) {
    if ((tempA % 10) < (tempB % 10)) return true;
    tempA = Math.floor(tempA / 10);
    tempB = Math.floor(tempB / 10);
  }
  return false;
}

// Generate subtraction with specific borrow constraints
export function getSubtractionPair(digits1: number, digits2: number, allowBorrow: boolean, minDistance: number = 0): [number, number] {
  let a, b;
  let attempts = 0;
  do {
    a = getNDigitNumber(digits1);
    b = getNDigitNumber(digits2);
    if (a < b) {
      const t = a; a = b; b = t;
    }
    attempts++;
  } while ((hasBorrow(a, b) !== allowBorrow || a - b < minDistance) && attempts < 50);
  return [a, b];
}
