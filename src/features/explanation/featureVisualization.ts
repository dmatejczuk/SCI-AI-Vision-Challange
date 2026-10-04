// Contiguous arithmetic means, not individual semantic concepts or attention maps.
export function aggregateFeatures(vector: ArrayLike<number>, maximumBars = 48): number[] {
  const count = Math.min(vector.length, Math.max(1, Math.floor(maximumBars)));
  if (!vector.length || !Number.isFinite(count)) return [];
  return Array.from({ length: count }, (_, index) => {
    const start = Math.floor((index * vector.length) / count);
    const end = Math.floor(((index + 1) * vector.length) / count);
    let total = 0;
    for (let position = start; position < end; position++)
      total += Number.isFinite(vector[position]) ? vector[position] : 0;
    return total / (end - start);
  });
}
