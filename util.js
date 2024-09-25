calculateMean = (arr) => {
    const sum = arr.reduce((acc, value) => acc + value, 0);
    return sum / arr.length;
}

calculateStandardDeviation = (arr) =>  {
    const mean = calculateMean(arr);

    // Calculate the squared differences from the mean
    const squaredDiffs = arr.map(value => {
        const diff = value - mean;
        return diff * diff;
    });

    // Calculate the variance (mean of squared differences)
    const variance = calculateMean(squaredDiffs);

    // Standard deviation is the square root of the variance
    return Math.sqrt(variance);
}

module.exports = {
    calculateMean,
    calculateStandardDeviation,
 }