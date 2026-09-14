import type { MutationOperator } from "@/generated/prisma/enums";

export interface OperatorInfo {
  value: MutationOperator;
  label: string;
  description: string;
  example: string;
}

export const MUTATION_OPERATORS: OperatorInfo[] = [
  {
    value: "ARITHMETIC_OPERATOR",
    label: "Arithmetic operator",
    description: "Replaces +, -, *, /, % with another arithmetic operator.",
    example: "a + b  ->  a - b",
  },
  {
    value: "RELATIONAL_OPERATOR",
    label: "Relational operator",
    description: "Changes a comparison such as < to <= or == to !=.",
    example: "x > MAX  ->  x >= MAX",
  },
  {
    value: "CONDITIONAL_OPERATOR",
    label: "Conditional operator",
    description: "Negates or forces a condition (true/false).",
    example: "if (ok)  ->  if (!ok)",
  },
  {
    value: "LOGICAL_OPERATOR",
    label: "Logical operator",
    description: "Swaps && with || or removes a logical operand.",
    example: "a && b  ->  a || b",
  },
  {
    value: "CONSTANT_REPLACEMENT",
    label: "Constant replacement",
    description: 'Changes a literal value (0 -> 1, MAX -> MAX+1, "" -> "x").',
    example: "return 0;  ->  return 1;",
  },
  {
    value: "RETURN_VALUE",
    label: "Return value",
    description: "Alters what a function returns.",
    example: "return result;  ->  return nullptr;",
  },
  {
    value: "STATEMENT_DELETION",
    label: "Statement deletion",
    description: "Removes a statement or a call.",
    example: "cleanup(ctx);  ->  (deleted)",
  },
  {
    value: "FUNCTION_CALL",
    label: "Function call",
    description: "Replaces a call target or its arguments.",
    example: "memcpy(a, b, n)  ->  memcpy(a, b, n - 1)",
  },
  {
    value: "CUSTOM",
    label: "Custom",
    description: "A hand-written mutation that does not fit the categories above.",
    example: "",
  },
  {
    value: "UNKNOWN",
    label: "Unknown",
    description: "Operator not classified yet.",
    example: "",
  },
];

const byValue = new Map(MUTATION_OPERATORS.map((o) => [o.value, o]));

export function operatorLabel(value: MutationOperator): string {
  return byValue.get(value)?.label ?? value;
}
