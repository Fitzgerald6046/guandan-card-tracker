export interface CalibrationSample {
  probability: number;
  outcome: 0 | 1;
  label?: string;
}

export interface CalibrationBin {
  lowerBound: number;
  upperBound: number;
  count: number;
  meanPrediction: number;
  observedFrequency: number;
  absoluteGap: number;
}

export interface CalibrationReport {
  sampleCount: number;
  brierScore: number;
  logLoss: number;
  expectedCalibrationError: number;
  bins: CalibrationBin[];
}

const clampProbability = (probability: number): number =>
  Math.min(1 - 1e-9, Math.max(1e-9, probability));

/** 汇总概率校准：Brier越低越好，ECE越接近0越好。 */
export function evaluateCalibration(
  samples: CalibrationSample[],
  binCount = 10
): CalibrationReport {
  if (samples.length === 0) {
    return {
      sampleCount: 0,
      brierScore: 0,
      logLoss: 0,
      expectedCalibrationError: 0,
      bins: []
    };
  }

  const bins = Array.from({ length: binCount }, (_, index) => {
    const lowerBound = index / binCount;
    const upperBound = (index + 1) / binCount;
    const binSamples = samples.filter(sample => {
      const targetIndex = Math.min(
        binCount - 1,
        Math.floor(Math.max(0, sample.probability) * binCount)
      );
      return targetIndex === index;
    });
    const meanPrediction = binSamples.length > 0
      ? binSamples.reduce(
        (total, sample) => total + sample.probability,
        0
      ) / binSamples.length
      : 0;
    const observedFrequency = binSamples.length > 0
      ? binSamples.reduce(
        (total, sample) => total + sample.outcome,
        0
      ) / binSamples.length
      : 0;
    return {
      lowerBound,
      upperBound,
      count: binSamples.length,
      meanPrediction,
      observedFrequency,
      absoluteGap: Math.abs(meanPrediction - observedFrequency)
    };
  }).filter(bin => bin.count > 0);
  const brierScore = samples.reduce(
    (total, sample) =>
      total + Math.pow(sample.probability - sample.outcome, 2),
    0
  ) / samples.length;
  const logLoss = samples.reduce((total, sample) => {
    const probability = clampProbability(sample.probability);
    return total - (
      sample.outcome * Math.log(probability) +
      (1 - sample.outcome) * Math.log(1 - probability)
    );
  }, 0) / samples.length;
  const expectedCalibrationError = bins.reduce(
    (total, bin) =>
      total + bin.absoluteGap * (bin.count / samples.length),
    0
  );

  return {
    sampleCount: samples.length,
    brierScore,
    logLoss,
    expectedCalibrationError,
    bins
  };
}
