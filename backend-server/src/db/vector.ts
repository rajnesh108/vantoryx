export function toVectorLiteral(values: number[]): string {
  return `[${values
    .map((value) => {
      if (!Number.isFinite(value)) {
        throw new Error("Non-finite embedding value");
      }
      return value.toFixed(8);
    })
    .join(",")}]`;
}
