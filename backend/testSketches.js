const BloomFilter = require("./bloomFilter");

const bloom = new BloomFilter();

bloom.add("request-1");
bloom.add("request-2");
bloom.add("request-3");

console.log("request-1:", bloom.mightContain("request-1"));
console.log("request-2:", bloom.mightContain("request-2"));
console.log("request-999:", bloom.mightContain("request-999"));

const HyperLogLog = require("./hyperLogLog");

const hll = new HyperLogLog();

for (let i = 0; i < 7000; i++) {
    hll.add(`request-${i}`);
}

for (let i = 0; i < 3000; i++) {
    hll.add(`request-${i}`);
}

console.log("Total requests: 10000");
console.log("Actual unique: 7000");
console.log("HLL estimate:", hll.estimate());