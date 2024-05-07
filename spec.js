const {assert} = require('chai');
const Logger = require('log-ng').default;
// Logger.setLogLevel('debug');
const {
	CIQ,
	ciqSeeded
} = require('./chartiq');
const uheprng = require('./grc');
const {
	gcd,
	generateLCGParams,
	isPrime,
} = require('./lcg');
const {
	lcg,
	PRNG
} = require('./PRNG');
const logger = new Logger('spec.js');

// Abramowitz and Stegun approximation of the error function
function erf(x){
	const a1 = 0.254829592;
	const a2 = -0.284496736;
	const a3 = 1.421413741;
	const a4 = -1.453152027;
	const a5 = 1.061405429;
	const p = 0.3275911;

	const sign = (x >= 0) ? 1 : -1;
	const t = 1 / (1 + p * Math.abs(x));
	const y = 1 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
	return sign * y;
}

const uniformCDF = value => value;
const uniformIntegerCDF = (min, max, value) => {
	if(value <= min){
		return 0;
	}
	if(value >= max){
		return 1;
	}
	return (value - min) / (max - min);
}
const normalCDF = (mean, stdDev, value) => 0.5 * (1 + erf((value - mean) / (Math.sqrt(2 * stdDev ** 2))));

function kolmogorovSmirnovTest(samples, theoreticalCDF){
	samples.sort((a, b) => a - b);

	const empiricalCDF = samples.map((value, index) => (index + 1) / samples.length);
	const differences = empiricalCDF.map((value, index) => Math.abs(value - theoreticalCDF(samples[index])));
	const D = Math.max(...differences);
	// const alpha = 1.36 / Math.sqrt(samples.length);
	const alpha = 1.63 / Math.sqrt(samples.length);
	const passed = D <= alpha;

	return {D, alpha, passed};
}

function chiSquaredBigInt(sequence, numBins){
	// logger.info('sequence:', sequence);
	// logger.info('numBins:', numBins);
	if(!(numBins instanceof BigInt)){
		numBins = BigInt(numBins);
	}
	sequence.sort((a, b) => a - b > 0 ? 1 : a - b < 0 ? -1 : 0);

	const min = sequence[0];
	const max = sequence[sequence.length - 1];
	// logger.info('min:', min, 'max:', max, 'range:', max - min);
	const binSize = (max - min + 1n) / numBins;
	// logger.info('binSize:', binSize);

	const observedFrequency = new Array(Number(numBins) + 1).fill(0n);
	// logger.info('observedFrequency:', observedFrequency, observedFrequency.length, typeof observedFrequency[0]);
	for(let i = 0; i < sequence.length; i++){
		// figure out which bin the value belongs to
		const bin = Number((sequence[i] - min) / binSize);
		try{
			observedFrequency[bin] += 1n;
		}catch(e){
			// logger.info('sequence:', sequence[i]);
			// logger.info('bin:', bin, typeof bin, 'observedFrequency[bin]:', observedFrequency[bin], typeof observedFrequency[bin]);
			assert(false);
		}
	}

	const expectedFrequency = BigInt(sequence.length) / numBins;

	let chiSquare = 0n;
	for(let i = 0; i < numBins; i++){
		const deviation = observedFrequency[i] - expectedFrequency;
		chiSquare += ((deviation ** 2n)) / (expectedFrequency);
	}

	// logger.info('chiSquare:', chiSquare);
	return chiSquare;
}

function calculateEntropy(data){
	let frequencies = {};

	// Calculate the frequency of each value in the data set
	for(let value of data){
		if(value in frequencies){
			frequencies[value]++;
		}else{
			frequencies[value] = 1;
		}
	}
	// logger.info('frequencies:', frequencies);

	let entropy = 0;
	const dataSize = data.length;

	// Calculate the entropy of the data set
	for(let key in frequencies){
		const frequency = frequencies[key] / dataSize;
		entropy -= frequency * Math.log2(frequency);
	}

	return entropy;
}

describe('Uniform distribution', function(){
	it('should produce uniform integer distribution [0, max)', function(){
		const numSamples = 1000;
		// const min = Number.MIN_SAFE_INTEGER;
		const min = 0;
		const max = Number.MAX_SAFE_INTEGER;

		const samples = Array.from({length: numSamples}, PRNG.uniform);
		const cdf = uniformIntegerCDF.bind(null, min, max);
		const {passed} = kolmogorovSmirnovTest(samples, cdf);

		assert.ok(passed, 'The generated samples do not follow a uniform distribution');
	});
	it('should produce uniform integer distribution [min, max)', function(){
		const numSamples = 1000;
		const min = 100;
		const max = 1000;

		const samples = Array.from({length: numSamples}, () => PRNG.integer(min, max));
		const cdf = uniformIntegerCDF.bind(null, min, max);
		const {passed} = kolmogorovSmirnovTest(samples, cdf);

		assert.ok(passed, 'The generated samples do not follow a uniform distribution');
	});
	it('should produce uniform proper BigInt distribution', function(){
		const numSamples = 1000;
		const min = BigInt(Number.MAX_SAFE_INTEGER);
		const max = BigInt(Number.MAX_SAFE_INTEGER * 2);
		// https://cdn.scribbr.com/wp-content/uploads/2022/05/chi-square-distribution-table.png
		const threshold = 50;

		const samples = Array.from({length: numSamples}, () => PRNG.biRandom(min, max));
		const numBins = Math.round(Math.sqrt(samples.length));
		const chiSquare = chiSquaredBigInt(samples, numBins);
		assert.ok(chiSquare < threshold, `Chi-Square value: ${chiSquare} exceeds threshold ${threshold}`);
	});
	it('should produce uniform BigInt distribution', function(){
		const numSamples = 1000;
		const min = 0;
		const max = BigInt(Number.MAX_SAFE_INTEGER * 2);
		// https://cdn.scribbr.com/wp-content/uploads/2022/05/chi-square-distribution-table.png
		const threshold = 50;

		const samples = Array.from({length: numSamples}, () => PRNG.biRandom(min, max));
		const numBins = Math.round(Math.sqrt(samples.length));
		const chiSquare = chiSquaredBigInt(samples, numBins);
		assert.ok(chiSquare < threshold, `Chi-Square value: ${chiSquare} exceeds threshold ${threshold}`);
	});
});

describe('Linear Congruential Generator', function(){
	// this.timeout(20000);
	it.skip('should generate high-quality LCG parameters', function(){
		const seed = 123;
		// const suggestedMax = 2 ** 30;
		const suggestedMax = 2 ** 18;
		const [a, c, m] = generateLCGParams(seed, suggestedMax);

		assert.isTrue(isPrime(a), 'Multiplier a is not a prime number');
		assert.strictEqual(gcd(c, m), 1, 'Increment c and modulus m are not relatively prime');
		assert.ok(m <= suggestedMax, 'Modulus m is not less than or equal to the maximum value');
	});
	it('should produce uniform seeded distribution', function(){
		const numSamples = 1000;
		const min = 0;
		// const max = Number.THIRTY_TWO_BIT_MAX;
		const max = 2 ** 32

		const samples = Array.from({length: numSamples}, PRNG.lcg);
		logger.info(`min: ${Math.min(...samples)}, max: ${Math.max(...samples)}`);
		logger.info(samples);
		const cdf = uniformIntegerCDF.bind(null, min, max);
		// const {passed} = kolmogorovSmirnovTest(samples, cdf);
		const result = kolmogorovSmirnovTest(samples, cdf);
		logger.info(result);

		assert.ok(result.passed, 'The generated samples do not follow a uniform distribution');
	});
	it('should produce a full period before repeating', function(){
		const seed = 123;
		// const suggestedMax = 2 ** 16;
		// const [a, c, m] = generateLCGParams(seed, suggestedMax);
		const [a, c, m] = [1664525, 1013904223, 2 ** 32];
		// logger.info(a, c, m, seed);
		const lcgTest = lcg('test', a, c, m, seed);

		const seen = new Set();
		const expected = 10**6;
		let value, i = 0;
		do{
			value = lcgTest();
			// logger.info(value);
			if(seen.has(value)){
				break;
			}
			seen.add(value);
		}while(++i < expected);

		assert.strictEqual(seen.size, expected, 'LCG does not have a full period');
	});
});

describe('Multiply With Carry', function(){
	it.skip('should produce uniform seeded distribution', function(){
		const numSamples = 40;
		const min = 0;
		// const max = Number.THIRTY_TWO_BIT_MAX;
		const max = 2 ** 32

		const samples = Array.from({length: numSamples}, PRNG.mwc);
		logger.info(`min: ${Math.min(...samples)}, max: ${Math.max(...samples)}`);
		logger.info(samples);
		const cdf = uniformIntegerCDF.bind(null, min, max);
		// const {passed} = kolmogorovSmirnovTest(samples, cdf);
		const result = kolmogorovSmirnovTest(samples, cdf);
		logger.info(JSON.stringify(result));

		assert.ok(result.passed, 'The generated samples do not follow a uniform distribution');
	});
});

describe('Normal distribution', function(){
	it('should pass Kolmogorov-Smirnov for normal distribution', function(){
		const numSamples = 1000;
		const mean = 50;
		const stdDev = 15;

		const samples = Array.from({length: numSamples}, PRNG.normal);
		const cdf = normalCDF.bind(null, mean, stdDev);
		const {passed} = kolmogorovSmirnovTest(samples, cdf);

		// Assert that the test result p-value is greater than a significance level (e.g., 0.05)
		assert.ok(passed, 'The generated samples do not follow a normal distribution');
	});
});

describe('CIQ', function(){
	it('should produce uniform seeded distribution', function(){
		const numSamples = 1000;

		const samples = Array.from({length: numSamples}, CIQ.random);
		// logger.info(samples);
		const {passed} = kolmogorovSmirnovTest(samples, uniformCDF);

		assert.ok(passed, 'The generated samples do not follow a uniform distribution');
	});
	it('should produce a full period before repeating', function(){
		// const seed = 123;
		const seed = 321;
		// const m = 126726
		const m = 2 ** 16.9514;
		// logger.info('seed:', seed, 'm:', m);
		const lcg = ciqSeeded(seed, seed);

		const seen = new Set();
		let value;
		do{
			value = lcg();
			// logger.info(value);
			if(seen.has(value)){
				break;
			}
			seen.add(value);
		}while(true);

		assert.notStrictEqual(seen.size, m, 'LCG does not have a full period');
	});
	it('should pass Kolmogorov-Smirnov for normal distribution', function(){
		const numSamples = 1000;
		const mean = 50;
		const stdDev = 15;

		const samples = Array.from({length: numSamples}, CIQ.gaussian);
		const cdf = normalCDF.bind(null, mean, stdDev);
		const {passed} = kolmogorovSmirnovTest(samples, cdf);

		assert.ok(passed, 'The generated samples do not follow a normal distribution');
	});
});

describe('GRC', function(){
	it('should produce uniform distribution [0, max)', function(){
		const numSamples = 1000;
		const min = 0;
		const max = Number.MAX_SAFE_INTEGER;

		const samples = Array.from({length: numSamples}, () => uheprng(max));
		// logger.info(samples);
		const cdf = uniformIntegerCDF.bind(null, min, max);
		const {passed} = kolmogorovSmirnovTest(samples, cdf);

		assert.ok(passed, 'The generated samples do not follow a uniform distribution');
	});
});

describe('Entropy test', function(){
	it('should detect high entropy', function(){
		const numSamples = 1000;
		const samples = Array.from({length: numSamples}, () => Math.random());
		const entropy = calculateEntropy(samples);
		// logger.info('Entropy:', entropy);

		// The entropy of a uniformly distributed random variable [0,1) is 1
		const threshold = 0.9;
		assert.ok(entropy > threshold, `Entropy is too low: ${entropy}`);
	});
	it('should detect low entropy', function(){
		const numSamples = 1000;
		const samples = Array.from({length: numSamples}, () => 0);
		const entropy = calculateEntropy(samples);
		// logger.info('Entropy:', entropy);

		// The entropy of a constant random variable is 0
		const threshold = 0.1;
		assert.ok(entropy < threshold, `Entropy is too high: ${entropy}`);
	});
	it('uniform integer distribution should have high entropy', function(){
		const numSamples = 1000;
		const samples = Array.from({length: numSamples}, PRNG.uniform);
		const entropy = calculateEntropy(samples);
		// logger.info('Entropy:', entropy);

		const threshold = 0.9;
		assert.ok(entropy > threshold, `Entropy is too low: ${entropy}`);
	});
	it('uniform BigInt distribution should have high entropy', function(){
		const numSamples = 1000;
		const min = BigInt(Number.MAX_SAFE_INTEGER);
		const max = BigInt(Number.MAX_SAFE_INTEGER * 2);
		const samples = Array.from({length: numSamples}, () => PRNG.biRandom(min, max));
		const entropy = calculateEntropy(samples);
		// logger.info('Entropy:', entropy);

		const threshold = 0.9;
		assert.ok(entropy > threshold, `Entropy is too low: ${entropy}`);
	});
	it('LCG should have high entropy', function(){
		const numSamples = 1000;
		const samples = Array.from({length: numSamples}, PRNG.lcg);
		const entropy = calculateEntropy(samples);
		// logger.info('Entropy:', entropy);

		const threshold = 0.9;
		assert.ok(entropy > threshold, `Entropy is too low: ${entropy}`);
	});
	it('normal distribution should have high entropy', function(){
		const numSamples = 1000;
		// const mean = 50;
		// const stdDev = 15;

		const samples = Array.from({length: numSamples}, PRNG.normal);
		const entropy = calculateEntropy(samples);
		// logger.info('Entropy:', entropy);

		const threshold = 0.9;
		assert.ok(entropy > threshold, `Entropy is too low: ${entropy}`);
	});
});

describe('Kolmogorov-Smirnov', function(){
	it('should pass for uniform distribution', function(){
		const numSamples = 1000;

		const samples = Array.from({length: numSamples}, () => Math.random());
		const {passed} = kolmogorovSmirnovTest(samples, uniformCDF);

		assert.ok(passed, 'The KS test does not pass for a uniform distribution');
	});
	it('should pass for normal distribution', function(){
		const numSamples = 1000;
		const mean = 0;
		const stdDev = 1;

		// Generate normal samples
		const samples = Array.from({length: numSamples}, () => {
			return mean + stdDev * Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
		});
		const cdf = normalCDF.bind(null, mean, stdDev);
		const {passed} = kolmogorovSmirnovTest(samples, cdf);

		assert.ok(passed, 'The KS test does not pass for a normal distribution');
	});
	it('should fail for non-conformant sequences', function(){
		const numSamples = 1000;
		const mean = 0;
		const stdDev = 1;

		const uniformSamples = Array.from({length: numSamples}, () => Math.random());
		const normalSamples = Array.from({length: numSamples}, () => {
			return mean + stdDev * Math.sqrt(-2 * Math.log(Math.random())) * Math.cos(2 * Math.PI * Math.random());
		});
		const normal = normalCDF.bind(null, mean, stdDev);
		const uniform = uniformCDF;

		let result = kolmogorovSmirnovTest(uniformSamples, normal);
		assert.notOk(result.passed, 'The KS test incorrectly passes for a non-conformant sequence');

		result = kolmogorovSmirnovTest(normalSamples, uniform);
		assert.notOk(result.passed, 'The KS test incorrectly passes for a non-conformant sequence');
	});
});
